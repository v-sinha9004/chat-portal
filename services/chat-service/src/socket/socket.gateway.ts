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
} from './interfaces/socket-events.interface';
import { ChatQueueProducer } from '../queue/chat-queue.producer';


@WebSocketGateway({
  cors: {
    origin: '*',
  },
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
  ) { }


  afterInit(server: Server) {
    this.socketService.setServer(server);
    this.logger.log('WebSocket Gateway initialized and server attached to SocketService');
  }

  /**
   * One-time handshake authentication.
   * Runs ONLY ONCE when client connects. Validates the JWT access token.
   * If invalid or missing, connection is rejected immediately.
   * If valid, attaches verified userId to client.data in memory and joins room.
   */
  handleConnection(client: AuthenticatedSocket) {
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

    // Enqueue message into BullMQ for asynchronous persistence
    await this.chatQueueProducer.enqueueDirectMessage(eventPayload);

    return {
      status: 'ok',
      messageId: eventPayload.id,
      conversationId,
      clientMessageId,
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

    // 4. Enqueue group message into BullMQ for asynchronous persistence
    await this.chatQueueProducer.enqueueGroupMessage(eventPayload);

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

