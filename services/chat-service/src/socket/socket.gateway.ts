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
import { SocketModerationService } from './services/socket-moderation.service';
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
    private readonly moderationService: SocketModerationService,
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
    return this.moderationService.handleUpdateDoubtStatus(client, payload);
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeleteMessagePayload,
  ) {
    return this.moderationService.handleDeleteMessage(client, payload);
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
