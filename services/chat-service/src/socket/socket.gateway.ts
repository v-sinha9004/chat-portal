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
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Server } from 'socket.io';
import { SocketService } from './socket.service';
import { PresenceService } from '../presence/presence.service';
import { MessagesService } from '../messages/messages.service';
import { SocketMessagingService } from './services/socket-messaging.service';
import { SocketReadReceiptsService } from './services/socket-read-receipts.service';
import { SocketPresenceHandlerService } from './services/socket-presence-handler.service';
import {
  AuthenticatedSocket,
  DirectMessagePayload,
  GroupMessagePayload,
  SubscribeUserPresencePayload,
  SubscribeGroupPresencePayload,
  TypingStartPayload,
  TypingStopPayload,
  MarkReadPayload,
  AckDeliveryPayload,
  UpdateDoubtStatusPayload,
  DeleteMessagePayload,
  DoubtStatusChangedEvent,
  UserPresenceChangedEvent,
  GroupPresenceChangedEvent,
  getUserPresenceRoom,
  getGroupPresenceRoom,
} from './interfaces/socket-events.interface';

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

  constructor(
    private readonly socketService: SocketService,
    private readonly presenceService: PresenceService,
    private readonly messagingService: SocketMessagingService,
    private readonly readReceiptsService: SocketReadReceiptsService,
    private readonly presenceHandlerService: SocketPresenceHandlerService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
  ) {}

  afterInit(server: Server) {
    this.socketService.setServer(server);
    this.presenceService.setServer(server);
    this.logger.log(
      'WebSocket Gateway initialized and server attached to SocketService and PresenceService',
    );
  }

  /**
   * One-time handshake authentication.
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
        const presenceEvent: UserPresenceChangedEvent = {
          userId,
          isOnline: true,
          lastSeen: null,
        };
        this.server.to(getUserPresenceRoom(userId)).emit('user_presence_changed', presenceEvent);

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
        const presenceEvent: UserPresenceChangedEvent = {
          userId,
          isOnline: false,
          lastSeen,
        };
        this.server.to(getUserPresenceRoom(userId)).emit('user_presence_changed', presenceEvent);

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

  // ---------------------------------------------------------------------------
  // Messaging Event Handlers
  // ---------------------------------------------------------------------------

  @SubscribeMessage('send_direct_message')
  async handleSendDirectMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DirectMessagePayload,
  ) {
    return this.messagingService.handleSendDirectMessage(this.server, client, payload);
  }

  @SubscribeMessage('send_group_message')
  async handleSendGroupMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: GroupMessagePayload,
  ) {
    return this.messagingService.handleSendGroupMessage(this.server, client, payload);
  }

  // ---------------------------------------------------------------------------
  // Doubts & Message Moderation
  // ---------------------------------------------------------------------------

  @SubscribeMessage('update_doubt_status')
  async handleUpdateDoubtStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: UpdateDoubtStatusPayload,
  ) {
    const { conversationId, messageId, status } = payload || {};
    if (!conversationId || !messageId || !status || (status !== 'OPEN' && status !== 'RESOLVED')) {
      return {
        status: 'error',
        message: 'Invalid payload: conversationId, messageId, and status (OPEN | RESOLVED) are required',
      };
    }

    const senderId = client.data.userId;
    if (!senderId) {
      return { status: 'error', message: 'Unauthorized socket session' };
    }

    const userRole = (client.data.user?.role || '').toUpperCase();
    const userName = client.data.user?.name || client.data.user?.email || 'User';

    try {
      const updatedMessage = await this.messagesService.updateDoubtStatus(
        senderId,
        userRole,
        userName,
        conversationId,
        messageId,
        status,
      );

      const eventPayload: DoubtStatusChangedEvent = {
        conversationId,
        messageId,
        status: (updatedMessage.doubtStatus as 'OPEN' | 'RESOLVED') || status,
        resolvedBy: updatedMessage.resolvedBy,
        resolvedByName: updatedMessage.resolvedByName,
        resolvedAt: updatedMessage.resolvedAt,
      };

      if (conversationId.startsWith('direct:')) {
        const parts = conversationId.replace('direct:', '').split(':');
        this.socketService.emitToUsers(parts, 'doubt_status_changed', eventPayload);
      } else if (conversationId.startsWith('group:')) {
        const groupId = conversationId.replace('group:', '');
        const memberIds = await this.socketService.getGroupMemberIds(groupId);
        if (memberIds && memberIds.length > 0) {
          this.socketService.emitToUsers(memberIds, 'doubt_status_changed', eventPayload);
        }
      }

      return {
        status: 'ok',
        message: `Doubt marked as ${status}`,
        data: eventPayload,
      };
    } catch (err: any) {
      return {
        status: 'error',
        message: err.message || 'Failed to update doubt status',
      };
    }
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeleteMessagePayload,
  ) {
    const { messageId } = payload || {};
    if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
      return { status: 'error', message: 'Invalid payload: messageId is required' };
    }

    const currentUserId = client.data.userId;
    if (!currentUserId) {
      return { status: 'error', message: 'Unauthorized socket session' };
    }

    const currentUserRole = client.data.user?.role || '';

    try {
      const result = await this.messagesService.deleteMessage(
        currentUserId,
        currentUserRole,
        messageId.trim(),
      );

      return {
        status: 'ok',
        message: result.message,
        messageId: result.messageId,
        conversationId: result.conversationId,
      };
    } catch (err: any) {
      return {
        status: 'error',
        message: err.message || 'Failed to delete message',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Presence Event Handlers
  // ---------------------------------------------------------------------------

  @SubscribeMessage('subscribe_user_presence')
  async handleSubscribeUserPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SubscribeUserPresencePayload,
  ) {
    return this.presenceHandlerService.handleSubscribeUserPresence(client, payload);
  }

  @SubscribeMessage('unsubscribe_user_presence')
  handleUnsubscribeUserPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SubscribeUserPresencePayload,
  ) {
    return this.presenceHandlerService.handleUnsubscribeUserPresence(client, payload);
  }

  @SubscribeMessage('subscribe_group_presence')
  async handleSubscribeGroupPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SubscribeGroupPresencePayload,
  ) {
    return this.presenceHandlerService.handleSubscribeGroupPresence(client, payload);
  }

  @SubscribeMessage('unsubscribe_group_presence')
  handleUnsubscribeGroupPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SubscribeGroupPresencePayload,
  ) {
    return this.presenceHandlerService.handleUnsubscribeGroupPresence(client, payload);
  }

  @SubscribeMessage('user_logout')
  async handleUserLogout(@ConnectedSocket() client: AuthenticatedSocket) {
    return this.presenceHandlerService.handleUserLogout(this.server, client);
  }

  // ---------------------------------------------------------------------------
  // Typing Event Handlers
  // ---------------------------------------------------------------------------

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingStartPayload,
  ) {
    return this.presenceHandlerService.handleTypingStart(client, payload);
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingStopPayload,
  ) {
    return this.presenceHandlerService.handleTypingStop(client, payload);
  }

  // ---------------------------------------------------------------------------
  // Read Receipts & Delivery Acks
  // ---------------------------------------------------------------------------

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkReadPayload,
  ) {
    return this.readReceiptsService.handleMarkRead(this.server, client, payload);
  }

  @SubscribeMessage('ack_delivery')
  async handleAckDelivery(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: AckDeliveryPayload,
  ) {
    return this.readReceiptsService.handleAckDelivery(this.server, client, payload);
  }
}
