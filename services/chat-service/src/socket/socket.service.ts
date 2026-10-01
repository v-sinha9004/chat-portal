import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { JwtUserPayload } from './interfaces/socket-events.interface';
import { UserServiceClient } from '../clients/user-service.client';

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private server: Server | null = null;

  constructor(private readonly userServiceClient: UserServiceClient) {}

  /**
   * Verifies and decodes a JWT access token.
   * Throws an error if the token is invalid, expired, or missing required claims.
   */
  verifyAccessToken(token: string): JwtUserPayload {
    const jwtSecret = process.env.JWT_ACCESS_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    const payload = jwt.verify(token, jwtSecret) as JwtUserPayload;
    if (!payload || !payload.sub) {
      throw new Error('Invalid token claims: sub missing');
    }

    return payload;
  }

  /**
   * Registers the Socket.io Server instance from the Gateway on initialization.
   */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('Socket.io server instance registered with SocketService');
  }

  /**
   * Returns the canonical room name for a given user ID.
   */
  getUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Emits an event with a payload to a specific user.
   * All active devices/sockets connected under this user will receive the event.
   */
  emitToUser<T = any>(userId: string, event: string, payload: T): void {
    if (!this.server) {
      this.logger.warn(
        `Cannot emit to user "${userId}": Socket server is not initialized`,
      );
      return;
    }
    const userRoom = this.getUserRoom(userId);
    this.logger.log(`Emitting event "${event}" to user room "${userRoom}"`);
    this.server.to(userRoom).emit(event, payload);
  }

  /**
   * Emits an event with a payload to multiple users (e.g. group chat participants).
   */
  emitToUsers<T = any>(userIds: string[], event: string, payload: T): void {
    if (!this.server) {
      this.logger.warn('Cannot emit to users: Socket server is not initialized');
      return;
    }
    if (!userIds || userIds.length === 0) {
      return;
    }
    const userRooms = userIds.map((id) => this.getUserRoom(id));
    this.logger.log(
      `Emitting event "${event}" to ${userRooms.length} user rooms`,
    );
    this.server.to(userRooms).emit(event, payload);
  }

  /**
   * Fetches fresh member IDs for a given group from user-service.
   * Direct inter-service HTTP query ensures newly added/removed members
   * are reflected instantly with zero stale caching.
   */
  async getGroupMemberIds(groupId: string): Promise<string[]> {
    return this.userServiceClient.getGroupMemberIds(groupId);
  }

  /**
   * Fetches group IDs that a user belongs to from user-service.
   */
  async getUserGroupIds(userId: string): Promise<string[]> {
    return this.userServiceClient.getUserGroupIds(userId);
  }
}

