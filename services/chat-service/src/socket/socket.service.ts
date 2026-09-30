import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { JwtUserPayload } from './interfaces/socket-events.interface';

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private server: Server | null = null;

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
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
    const url = `${userServiceUrl}/api/users/groups/${encodeURIComponent(groupId)}/member-ids`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.warn(`Group not found in user-service: ${groupId}`);
          return [];
        }
        this.logger.error(
          `Failed to fetch group members for ${groupId}: HTTP ${response.status}`,
        );
        return [];
      }

      const data = (await response.json()) as { groupId: string; memberIds: string[] };
      return data?.memberIds || [];
    } catch (err: any) {
      this.logger.error(
        `Error calling user-service for group ${groupId} members: ${err.message}`,
      );
      return [];
    }
  }

  /**
   * Fetches group IDs that a user belongs to from user-service.
   */
  async getUserGroupIds(userId: string): Promise<string[]> {
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
    const url = `${userServiceUrl}/api/users/groups/user/${encodeURIComponent(userId)}/group-ids`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { userId: string; groupIds: string[] };
      return data?.groupIds || [];
    } catch (err: any) {
      this.logger.error(
        `Error calling user-service for user ${userId} group IDs: ${err.message}`,
      );
      return [];
    }
  }
}

