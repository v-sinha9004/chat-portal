import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { monotonicFactory } from 'ulid';
import { SocketService } from '../socket.service';
import { ChatQueueProducer } from '../../queue/chat-queue.producer';
import { PresenceService } from '../../presence/presence.service';
import { ReadTrackingService } from '../../read-tracking/read-tracking.service';
import { UserServiceClient } from '../../clients/user-service.client';
import {
  AuthenticatedSocket,
  DirectMessagePayload,
  GroupMessagePayload,
  NewMessageEvent,
  GroupMessageEvent,
  getDirectConversationId,
  getGroupConversationId,
  ConversationReadAckEvent,
  MessageDeliveredEvent,
  MessagesReadEvent,
  GroupMessagesReadEvent,
} from '../interfaces/socket-events.interface';

@Injectable()
export class SocketMessagingService {
  private readonly logger = new Logger(SocketMessagingService.name);
  private readonly ulid = monotonicFactory();

  constructor(
    private readonly socketService: SocketService,
    private readonly chatQueueProducer: ChatQueueProducer,
    private readonly presenceService: PresenceService,
    private readonly readTrackingService: ReadTrackingService,
    private readonly userServiceClient: UserServiceClient,
  ) {}

  async handleSendDirectMessage(
    server: Server,
    client: AuthenticatedSocket,
    payload: DirectMessagePayload,
  ) {
    const { recipientId, message, clientMessageId, isAnnouncement, replyTo, isDoubt, doubtTopic, attachments } = payload || {};
    if (isAnnouncement) {
      return {
        status: 'error',
        message: 'Announcements can only be posted in group chats.',
      };
    }
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!recipientId || (!message && !hasAttachments)) {
      return {
        status: 'error',
        message: 'RecipientId and either message or attachments are required',
      };
    }

    const senderRole = (client.data.user?.role || '').toUpperCase();
    if (senderRole === 'MENTEE') {
      const recipient = await this.userServiceClient.getUserById(recipientId);
      if (recipient && (recipient.role || '').toUpperCase() === 'MENTEE') {
        return {
          status: 'error',
          message: 'Mentees cannot chat directly with other mentees.',
        };
      }
    }

    const senderId = client.data.userId || client.id;
    const messageId = this.ulid();
    const conversationId = getDirectConversationId(senderId, recipientId);

    const eventPayload: NewMessageEvent<{ message: string }> = {
      id: messageId,
      conversationId,
      senderId,
      recipientId,
      data: { message: message || '' },
      attachments: attachments || [],
      timestamp: new Date().toISOString(),
      ...(clientMessageId ? { clientMessageId } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(isDoubt
        ? {
            isDoubt: true,
            doubtStatus: 'OPEN',
            doubtTopic: doubtTopic ? doubtTopic.trim() : undefined,
          }
        : {}),
    };

    // Delegates to SocketService.emitToUser
    this.socketService.emitToUser(recipientId, 'direct_message', eventPayload);

    // Increment recipient's unread count in Redis RAM (~0.1ms)
    await this.readTrackingService.incrementUnreadCount(recipientId, conversationId);

    // Sender has by definition read up to their own newly sent message
    await this.readTrackingService.resetUnreadAndSetLastRead(
      senderId,
      conversationId,
      messageId,
    );

    // Multi-tab synchronization: broadcast ack to sender's room
    const ackPayload: ConversationReadAckEvent = {
      conversationId,
      lastReadMessageId: messageId,
    };
    server
      .to(this.socketService.getUserRoom(senderId))
      .emit('conversation_read_ack', ackPayload);

    // Enqueue message into BullMQ for asynchronous persistence
    await this.chatQueueProducer.enqueueDirectMessage(eventPayload);

    // Enqueue sender's lastRead persistence into BullMQ
    await this.chatQueueProducer.enqueuePersistLastRead({
      userId: senderId,
      conversationId,
      lastReadMessageId: messageId,
    });

    // Real-time delivery detection: check if recipient is online
    const recipientPresence = await this.presenceService.getUserPresence(recipientId);
    const isRecipientOnline = recipientPresence?.isOnline || false;
    if (isRecipientOnline) {
      const deliveredEvent: MessageDeliveredEvent = {
        conversationId,
        messageId,
        recipientId,
        deliveredAt: new Date().toISOString(),
      };
      server
        .to(this.socketService.getUserRoom(senderId))
        .emit('message_delivered', deliveredEvent);
    }

    // Sender has read up to messageId; notify recipient that previous messages are read
    const readEvent: MessagesReadEvent = {
      conversationId,
      readerId: senderId,
      lastReadMessageId: messageId,
      readAt: new Date().toISOString(),
    };
    server
      .to(this.socketService.getUserRoom(recipientId))
      .emit('messages_read', readEvent);

    return {
      status: 'ok',
      messageId: eventPayload.id,
      conversationId,
      clientMessageId,
      delivered: isRecipientOnline,
      message: `Message dispatched to user ${recipientId}`,
      data: eventPayload,
    };
  }

  async handleSendGroupMessage(
    server: Server,
    client: AuthenticatedSocket,
    payload: GroupMessagePayload,
  ) {
    const { groupId, message, clientMessageId, isAnnouncement, heading, replyTo, isDoubt, doubtTopic, attachments } = payload || {};
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!groupId || (!message && !hasAttachments)) {
      return {
        status: 'error',
        message: 'GroupId and either message or attachments are required',
      };
    }

    if (isAnnouncement && isDoubt) {
      return {
        status: 'error',
        message: 'A message cannot be both an announcement and a doubt.',
      };
    }

    if (isAnnouncement) {
      const userRole = (client.data.user?.role || '').toUpperCase();
      if (userRole !== 'MENTOR' && userRole !== 'ADMIN') {
        return {
          status: 'error',
          message: 'Forbidden: Only mentors can post announcements.',
        };
      }
      if (!heading || !heading.trim()) {
        return {
          status: 'error',
          message: 'Announcement heading is required.',
        };
      }
    }

    const senderId = client.data.userId;
    if (!senderId) {
      return {
        status: 'error',
        message: 'Unauthorized socket session',
      };
    }

    // 1. Fetch fresh member IDs from user-service
    const memberIds = await this.socketService.getGroupMemberIds(groupId);
    if (!memberIds || memberIds.length === 0) {
      return {
        status: 'error',
        message: 'Group not found or has no members',
      };
    }

    // 2. Strict authorization check: sender must be a member
    if (!memberIds.includes(senderId)) {
      return {
        status: 'error',
        message: 'Forbidden: You are not a member of this group',
      };
    }

    const messageId = this.ulid();
    const conversationId = getGroupConversationId(groupId);
    const eventPayload: GroupMessageEvent<{ message: string }> = {
      id: messageId,
      conversationId,
      groupId,
      senderId,
      data: { message: message || '' },
      attachments: attachments || [],
      timestamp: new Date().toISOString(),
      ...(clientMessageId ? { clientMessageId } : {}),
      ...(isAnnouncement ? { isAnnouncement: true, heading: heading.trim() } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(isDoubt
        ? {
            isDoubt: true,
            doubtStatus: 'OPEN',
            doubtTopic: doubtTopic ? doubtTopic.trim() : undefined,
          }
        : {}),
    };

    // 3. Dispatch ONLY to member user rooms
    this.socketService.emitToUsers(memberIds, 'group_message', eventPayload);

    // Batch increment group members' unread count in Redis (excluding sender)
    const recipientIds = memberIds.filter((id) => id !== senderId);
    if (recipientIds.length > 0) {
      await this.readTrackingService.incrementUnreadCountBatch(recipientIds, conversationId);
    }

    // Sender has by definition read up to their own newly sent message
    await this.readTrackingService.resetUnreadAndSetLastRead(
      senderId,
      conversationId,
      messageId,
    );

    // Multi-tab synchronization: broadcast ack to sender's room
    const ackPayload: ConversationReadAckEvent = {
      conversationId,
      lastReadMessageId: messageId,
    };
    server
      .to(this.socketService.getUserRoom(senderId))
      .emit('conversation_read_ack', ackPayload);

    // 4. Enqueue group message into BullMQ for asynchronous persistence
    await this.chatQueueProducer.enqueueGroupMessage(eventPayload);

    // Enqueue sender's lastRead persistence into BullMQ
    await this.chatQueueProducer.enqueuePersistLastRead({
      userId: senderId,
      conversationId,
      lastReadMessageId: messageId,
    });

    // Sender read up to messageId; broadcast read watermark to group members
    if (recipientIds.length > 0) {
      const groupReadEvent: GroupMessagesReadEvent = {
        conversationId,
        groupId,
        readerId: senderId,
        lastReadMessageId: messageId,
        readAt: new Date().toISOString(),
      };
      this.socketService.emitToUsers(recipientIds, 'group_messages_read', groupReadEvent);
    }

    return {
      status: 'ok',
      messageId: eventPayload.id,
      conversationId,
      clientMessageId,
      groupId,
      message: `Message dispatched to group ${groupId}`,
      data: eventPayload,
    };
  }
}
