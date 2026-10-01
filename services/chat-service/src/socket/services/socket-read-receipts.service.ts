import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { SocketService } from '../socket.service';
import { ReadTrackingService } from '../../read-tracking/read-tracking.service';
import { ChatQueueProducer } from '../../queue/chat-queue.producer';
import {
  AuthenticatedSocket,
  MarkReadPayload,
  AckDeliveryPayload,
  ConversationReadAckEvent,
  MessagesReadEvent,
  GroupMessagesReadEvent,
  MessageDeliveredEvent,
} from '../interfaces/socket-events.interface';

@Injectable()
export class SocketReadReceiptsService {
  private readonly logger = new Logger(SocketReadReceiptsService.name);

  constructor(
    private readonly socketService: SocketService,
    private readonly readTrackingService: ReadTrackingService,
    private readonly chatQueueProducer: ChatQueueProducer,
  ) {}

  async handleMarkRead(
    server: Server,
    client: AuthenticatedSocket,
    payload: MarkReadPayload,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { status: 'error', message: 'Unauthorized socket session' };
    }

    const { conversationId, lastReadMessageId } = payload || {};
    if (!conversationId) {
      return { status: 'error', message: 'conversationId is required' };
    }

    // 1. Reset unread count to 0 and update lastRead in Redis (~0.1ms)
    await this.readTrackingService.resetUnreadAndSetLastRead(
      userId,
      conversationId,
      lastReadMessageId || '',
    );

    // 2. Multi-tab synchronization: broadcast ack to user's room
    const ackPayload: ConversationReadAckEvent = {
      conversationId,
      lastReadMessageId: lastReadMessageId || '',
    };
    server
      .to(this.socketService.getUserRoom(userId))
      .emit('conversation_read_ack', ackPayload);

    // 3. Asynchronously enqueue durable persistence to MongoDB
    if (lastReadMessageId) {
      this.chatQueueProducer
        .enqueuePersistLastRead({
          userId,
          conversationId,
          lastReadMessageId,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to enqueue persist-lastread job for ${userId}: ${err.message}`,
          );
        });
    }

    // 4. Real-time read receipt notification to chat partner(s)
    if (conversationId.startsWith('direct:')) {
      const parts = conversationId.slice(7).split(':');
      const partnerId = parts.find((id) => id !== userId);
      if (partnerId && lastReadMessageId) {
        const readEvent: MessagesReadEvent = {
          conversationId,
          readerId: userId,
          lastReadMessageId,
          readAt: new Date().toISOString(),
        };
        server
          .to(this.socketService.getUserRoom(partnerId))
          .emit('messages_read', readEvent);
      }
    } else if (conversationId.startsWith('group:')) {
      const groupId = conversationId.slice(6);
      this.socketService
        .getGroupMemberIds(groupId)
        .then((memberIds) => {
          const otherMembers = memberIds.filter((id) => id !== userId);
          if (otherMembers.length > 0 && lastReadMessageId) {
            const groupReadEvent: GroupMessagesReadEvent = {
              conversationId,
              groupId,
              readerId: userId,
              lastReadMessageId,
              readAt: new Date().toISOString(),
            };
            this.socketService.emitToUsers(
              otherMembers,
              'group_messages_read',
              groupReadEvent,
            );
          }
        })
        .catch((err) => {
          this.logger.warn(
            `Failed to emit group_messages_read for group ${groupId}: ${err.message}`,
          );
        });
    }

    return {
      status: 'ok',
      conversationId,
      lastReadMessageId,
    };
  }

  async handleAckDelivery(
    server: Server,
    client: AuthenticatedSocket,
    payload: AckDeliveryPayload,
  ) {
    const recipientId = client.data.userId;
    if (!recipientId) return { status: 'error', message: 'Unauthorized' };

    const { conversationId, messageId, senderId: explicitSenderId } = payload || {};
    if (!conversationId || !messageId) {
      return { status: 'error', message: 'conversationId and messageId are required' };
    }

    if (conversationId.startsWith('direct:')) {
      const parts = conversationId.slice(7).split(':');
      const senderId = explicitSenderId || parts.find((id) => id !== recipientId);
      if (senderId) {
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
    }

    return { status: 'ok' };
  }
}
