import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { monotonicFactory } from 'ulid';
import { Server } from 'socket.io';
import { SocketService } from './socket.service';
import {
  AuthenticatedSocket,
  DirectMessagePayload,
  GroupMessagePayload,
  GroupMessageEvent,
  NewMessageEvent,
  getDirectConversationId,
  getGroupConversationId,
  getUserPresenceRoom,
  getGroupPresenceRoom,
  UserPresenceChangedEvent,
  GroupPresenceChangedEvent,
  SubscribeUserPresencePayload,
  SubscribeGroupPresencePayload,
  TypingStartPayload,
  TypingStopPayload,
  UserTypingEvent,
  MarkReadPayload,
  ConversationReadAckEvent,
  AckDeliveryPayload,
  MessageDeliveredEvent,
  MessagesReadEvent,
  GroupMessagesReadEvent,
} from './interfaces/socket-events.interface';
import { ChatQueueProducer } from '../queue/chat-queue.producer';
import { PresenceService } from '../presence/presence.service';
import { ReadTrackingService } from '../read-tracking/read-tracking.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  pingInterval: 25000,
  pingTimeout: 20000,
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);
  private readonly ulid = monotonicFactory();

  constructor(
    private readonly socketService: SocketService,
    private readonly chatQueueProducer: ChatQueueProducer,
    private readonly presenceService: PresenceService,
    private readonly readTrackingService: ReadTrackingService,
  ) { }

  afterInit(server: Server) {
    this.socketService.setServer(server);
    this.presenceService.setServer(server);
    this.logger.log(
      'WebSocket Gateway initialized and server attached to SocketService and PresenceService',
    );
  }

  /**
   * One-time handshake authentication.
   * Runs ONLY ONCE when client connects. Validates the JWT access token.
   * If valid, attaches verified userId to client.data in memory, joins user room,
   * and tracks active connection in PresenceService.
   */
  async handleConnection(client: AuthenticatedSocket) {
    const token = (client.handshake.auth?.token ||
      client.handshake.query?.token) as string | undefined;

    if (!token) {
      this.logger.warn(
        `Socket connection rejected: Missing auth token (Client: ${client.id})`,
      );
      client.emit('error', { message: 'Authentication token required' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.socketService.verifyAccessToken(token);
      const userId = payload.sub;
      client.data.userId = userId;
      client.data.user = payload;

      const userRoom = this.socketService.getUserRoom(userId);
      client.join(userRoom);
      this.logger.log(
        `Client authenticated: ${client.id} (User: "${userId}", Role: "${payload.role}") -> Auto-joined room "${userRoom}"`,
      );

      // Track active presence in Redis
      const { isFirstSocket } = await this.presenceService.addSocket(userId, client.id);
      if (isFirstSocket) {
        // Notify direct chat subscribers who have this user open
        const presenceEvent: UserPresenceChangedEvent = {
          userId,
          isOnline: true,
          lastSeen: null,
        };
        this.server.to(getUserPresenceRoom(userId)).emit('user_presence_changed', presenceEvent);

        // Notify active group presence rooms that this user belongs to
        this.socketService.getUserGroupIds(userId).then((groupIds) => {
          for (const groupId of groupIds) {
            const groupEvent: GroupPresenceChangedEvent = {
              groupId,
              userId,
              isOnline: true,
            };
            this.server.to(getGroupPresenceRoom(groupId)).emit('group_presence_changed', groupEvent);
          }
        }).catch((err) => {
          this.logger.warn(`Could not emit group presence for user ${userId}: ${err.message}`);
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `Socket connection rejected: Invalid or expired token (Client: ${client.id}) - ${err.message}`,
      );
      client.emit('error', {
        message: 'Authentication failed: Invalid or expired token',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.userId;
    this.logger.log(
      `Client disconnected: ${client.id}${userId ? ` (User: "${userId}")` : ''}`,
    );

    if (userId) {
      this.presenceService.removeSocket(userId, client.id, (lastSeen) => {
        // Triggered only after 10-second grace period if 0 sockets remain
        const presenceEvent: UserPresenceChangedEvent = {
          userId,
          isOnline: false,
          lastSeen,
        };
        this.server.to(getUserPresenceRoom(userId)).emit('user_presence_changed', presenceEvent);

        // Notify active group presence rooms that this user belongs to
        this.socketService.getUserGroupIds(userId).then((groupIds) => {
          for (const groupId of groupIds) {
            const groupEvent: GroupPresenceChangedEvent = {
              groupId,
              userId,
              isOnline: false,
            };
            this.server.to(getGroupPresenceRoom(groupId)).emit('group_presence_changed', groupEvent);
          }
        }).catch((err) => {
          this.logger.warn(`Could not emit group offline presence for user ${userId}: ${err.message}`);
        });
      }).catch((err) => {
        this.logger.error(`Error in presence removeSocket for user ${userId}: ${err.message}`);
      });
    }
  }

  /**
   * Real-time message dispatch.
   * Zero token checks / zero crypto operations.
   * Instantly reads client.data.userId from RAM in 0ms.
   */
  @SubscribeMessage('send_direct_message')
  async handleSendDirectMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DirectMessagePayload,
  ) {
    const { recipientId, message, clientMessageId } = payload || {};
    if (!recipientId || !message) {
      return {
        status: 'error',
        message: 'Both recipientId and message are required',
      };
    }

    const senderId = client.data.userId || client.id;
    const messageId = this.ulid();
    const conversationId = getDirectConversationId(senderId, recipientId);

    const eventPayload: NewMessageEvent<{ message: string }> = {
      id: messageId,
      conversationId,
      senderId,
      recipientId,
      data: { message },
      timestamp: new Date().toISOString(),
      ...(clientMessageId ? { clientMessageId } : {}),
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
    this.server
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
      this.server
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
    this.server
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

  /**
   * Real-time group message dispatch.
   * 1. Reads verified senderId from client.data.userId in RAM (0ms).
   * 2. Queries fresh group memberIds from user-service (direct query, zero stale caching).
   * 3. Rejects with error ACK if sender is not in group members.
   * 4. Fans out ONLY to verified member user rooms ('user:<memberId>').
   */
  @SubscribeMessage('send_group_message')
  async handleSendGroupMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: GroupMessagePayload,
  ) {
    const { groupId, message, clientMessageId } = payload || {};
    if (!groupId || !message) {
      return {
        status: 'error',
        message: 'Both groupId and message are required',
      };
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
      data: { message },
      timestamp: new Date().toISOString(),
      ...(clientMessageId ? { clientMessageId } : {}),
    };

    // 3. Dispatch ONLY to member user rooms
    this.socketService.emitToUsers(memberIds, 'group_message', eventPayload);

    // Batch increment group members' unread count in Redis (excluding sender) via pipeline (<1ms)
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
    this.server
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

  /**
   * On-demand presence subscription for a single user (active direct chat).
   * Joins room: presence:user:<targetUserId>
   * Returns immediate presence status.
   */
  @SubscribeMessage('subscribe_user_presence')
  async handleSubscribeUserPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SubscribeUserPresencePayload,
  ) {
    const { targetUserId } = payload || {};
    if (!targetUserId) {
      return { status: 'error', message: 'targetUserId is required' };
    }
    const room = getUserPresenceRoom(targetUserId);
    client.join(room);

    const presence = await this.presenceService.getUserPresence(targetUserId);
    return {
      status: 'ok',
      ...presence,
    };
  }

  /**
   * Leave presence room when switching away from direct chat.
   */
  @SubscribeMessage('unsubscribe_user_presence')
  handleUnsubscribeUserPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SubscribeUserPresencePayload,
  ) {
    const { targetUserId } = payload || {};
    if (targetUserId) {
      client.leave(getUserPresenceRoom(targetUserId));
    }
    return { status: 'ok' };
  }

  /**
   * On-demand presence subscription for a group (active group chat).
   * Joins room: presence:group:<groupId>
   * Returns total members, online count, and list of online member IDs.
   */
  @SubscribeMessage('subscribe_group_presence')
  async handleSubscribeGroupPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SubscribeGroupPresencePayload,
  ) {
    const { groupId } = payload || {};
    if (!groupId) {
      return { status: 'error', message: 'groupId is required' };
    }
    const room = getGroupPresenceRoom(groupId);
    client.join(room);

    const memberIds = await this.socketService.getGroupMemberIds(groupId);
    const presence = await this.presenceService.getGroupPresence(groupId, memberIds);
    return {
      status: 'ok',
      ...presence,
    };
  }

  /**
   * Leave group presence room when switching away from group chat.
   */
  @SubscribeMessage('unsubscribe_group_presence')
  handleUnsubscribeGroupPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SubscribeGroupPresencePayload,
  ) {
    const { groupId } = payload || {};
    if (groupId) {
      client.leave(getGroupPresenceRoom(groupId));
    }
    return { status: 'ok' };
  }

  /**
   * Explicit user logout handler. Immediately transitions user to offline
   * without waiting for the 10-second reconnection grace period.
   */
  @SubscribeMessage('user_logout')
  async handleUserLogout(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.data.userId;
    if (userId) {
      this.logger.log(`Explicit logout received for user "${userId}" (Socket: ${client.id})`);
      await this.presenceService.removeSocket(
        userId,
        client.id,
        (lastSeen) => {
          const presenceEvent: UserPresenceChangedEvent = {
            userId,
            isOnline: false,
            lastSeen,
          };
          this.server.to(getUserPresenceRoom(userId)).emit('user_presence_changed', presenceEvent);

          this.socketService
            .getUserGroupIds(userId)
            .then((groupIds) => {
              for (const groupId of groupIds) {
                const groupEvent: GroupPresenceChangedEvent = {
                  groupId,
                  userId,
                  isOnline: false,
                };
                this.server
                  .to(getGroupPresenceRoom(groupId))
                  .emit('group_presence_changed', groupEvent);
              }
            })
            .catch((err) => {
              this.logger.warn(
                `Could not emit group offline presence on logout for user ${userId}: ${err.message}`,
              );
            });
        },
        true,
      );
    }
    return { status: 'ok' };
  }

  /**
   * Real-time typing start indicator.
   * - In direct chat: emitted directly to recipient's user room.
   * - In group chat: emitted strictly to active group presence room (users actively viewing).
   */
  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingStartPayload,
  ) {
    const senderId = client.data.userId;
    if (!senderId) return { status: 'error', message: 'Unauthorized' };

    const { recipientId, groupId } = payload || {};
    const eventPayload: UserTypingEvent = {
      userId: senderId,
      isTyping: true,
      ...(recipientId ? { recipientId } : {}),
      ...(groupId ? { groupId } : {}),
    };

    if (recipientId) {
      this.socketService.emitToUser(recipientId, 'user_typing', eventPayload);
    } else if (groupId) {
      // Scoped fan-out: strictly emit to users actively viewing this group chat (excludes sender)
      client.to(getGroupPresenceRoom(groupId)).emit('user_typing', eventPayload);
    }

    return { status: 'ok' };
  }

  /**
   * Real-time typing stop indicator.
   */
  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingStopPayload,
  ) {
    const senderId = client.data.userId;
    if (!senderId) return { status: 'error', message: 'Unauthorized' };

    const { recipientId, groupId } = payload || {};
    const eventPayload: UserTypingEvent = {
      userId: senderId,
      isTyping: false,
      ...(recipientId ? { recipientId } : {}),
      ...(groupId ? { groupId } : {}),
    };

    if (recipientId) {
      this.socketService.emitToUser(recipientId, 'user_typing', eventPayload);
    } else if (groupId) {
      client.to(getGroupPresenceRoom(groupId)).emit('user_typing', eventPayload);
    }

    return { status: 'ok' };
  }

  /**
   * Real-time read receipt and unread counter reset.
   * Resets this conversation's unread counter to 0 and stores lastReadMessageId in Redis.
   * Broadcasts conversation_read_ack to all open tabs for this user.
   * Enqueues durable persistence to MongoDB via BullMQ.
   */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkReadPayload,
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
    this.server
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
        this.server
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

  /**
   * Real-time delivery receipt from recipient client device.
   * Notifies the message sender that the message has arrived on recipient's device.
   */
  @SubscribeMessage('ack_delivery')
  async handleAckDelivery(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: AckDeliveryPayload,
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
        this.server
          .to(this.socketService.getUserRoom(senderId))
          .emit('message_delivered', deliveredEvent);
      }
    }

    return { status: 'ok' };
  }
}


