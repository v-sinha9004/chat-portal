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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(private readonly socketService: SocketService) {}

  afterInit(server: Server) {
    this.socketService.setServer(server);
    this.logger.log('WebSocket Gateway initialized and server attached to SocketService');
  }

  handleConnection(client: AuthenticatedSocket) {
    const userId = (client.handshake.auth?.userId ||
      client.handshake.query?.userId) as string | undefined;

    if (userId) {
      client.data.userId = userId;
      const userRoom = this.socketService.getUserRoom(userId);
      client.join(userRoom);
      this.logger.log(
        `Client connected: ${client.id} (User: "${userId}") -> Auto-joined room "${userRoom}"`,
      );
    } else {
      this.logger.log(
        `Client connected anonymously: ${client.id} (No userId provided in handshake)`,
      );
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.userId;
    this.logger.log(
      `Client disconnected: ${client.id}${userId ? ` (User: "${userId}")` : ''}`,
    );
  }

  @SubscribeMessage('send_direct_message')
  handleSendDirectMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DirectMessagePayload,
  ) {
    const { recipientId, message } = payload || {};
    if (!recipientId || !message) {
      return {
        status: 'error',
        message: 'Both recipientId and message are required',
      };
    }

    const senderId = client.data.userId || client.id;

    const eventPayload: NewMessageEvent<{ message: string }> = {
      senderId,
      recipientId,
      data: { message },
      timestamp: new Date().toISOString(),
    };

    // Delegates to SocketService.emitToUser
    this.socketService.emitToUser(recipientId, 'direct_message', eventPayload);

    return { status: 'ok', message: `Message dispatched to user ${recipientId}` };
  }
}
