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
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { SocketService } from './socket.service';
import {
  AuthenticatedSocket,
  DirectMessagePayload,
  NewMessageEvent,
} from './interfaces/socket-events.interface';

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

  constructor(private readonly socketService: SocketService) { }

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
  handleSendDirectMessage(
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
    const messageId = randomUUID();

    const eventPayload: NewMessageEvent<{ message: string }> = {
      id: messageId,
      senderId,
      recipientId,
      data: { message },
      timestamp: new Date().toISOString(),
      ...(clientMessageId ? { clientMessageId } : {}),
    };

    // Delegates to SocketService.emitToUser
    this.socketService.emitToUser(recipientId, 'direct_message', eventPayload);

    return {
      status: 'ok',
      messageId: eventPayload.id,
      clientMessageId,
      message: `Message dispatched to user ${recipientId}`,
      data: eventPayload,
    };
  }
}
