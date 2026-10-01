import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { Server } from 'socket.io';

import { RedisService } from '../redis/redis.service';

export interface UserPresenceResult {
  userId: string;
  isOnline: boolean;
  lastSeen: string | null;
}

export interface GroupPresenceResult {
  groupId: string;
  totalMembers: number;
  onlineCount: number;
  onlineMemberIds: string[];
}

import { UserServiceClient } from '../clients/user-service.client';

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis: Redis;
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();
  private readonly GRACE_PERIOD_MS = 10000; // 10-second reconnection grace period
  private readonly SOCKET_EXPIRY_MS = 35000; // 35-second expiration threshold for inactive/dead sockets
  private readonly HEARTBEAT_INTERVAL_MS = 15000; // 15-second heartbeat interval to refresh active sockets
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private server: Server | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly userServiceClient: UserServiceClient,
  ) {
    this.redis = this.redisService.getClient();
  }

  async onModuleInit() {
    await this.cleanupStalePresence();
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const timer of this.graceTimers.values()) {
      clearTimeout(timer);
    }
    this.graceTimers.clear();
  }

  /**
   * Attaches the Socket.IO server to allow socket liveness verification and heartbeats.
   */
  setServer(server: Server): void {
    this.server = server;
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this.refreshHeartbeats().catch((err) => {
          this.logger.warn(`Error during presence heartbeat refresh: ${err.message}`);
        });
      }, this.HEARTBEAT_INTERVAL_MS);
      this.logger.log('Presence heartbeat interval started (15s cadence)');
    }
  }

  /**
   * Periodic heartbeat to refresh TTL/timestamps of all locally connected active sockets in Redis.
   */
  private async refreshHeartbeats(): Promise<void> {
    if (!this.server) return;
    try {
      const localSockets = this.server.sockets?.sockets;
      if (!localSockets || localSockets.size === 0) return;

      const now = Date.now();
      const pipeline = this.redis.pipeline();

      for (const [socketId, socket] of localSockets.entries()) {
        const userId = (socket as any).data?.userId;
        if (userId) {
          const key = this.getUserSocketsKey(userId);
          pipeline.zadd(key, now, socketId);
          pipeline.expire(key, 86400); // 24-hour key expiration safety
        }
      }

      await pipeline.exec();
    } catch (err: any) {
      this.logger.warn(`Failed to refresh presence heartbeats: ${err.message}`);
    }
  }

  /**
   * Startup cleanup to purge stale presence keys left behind by previous crashes or server restarts.
   */
  private async cleanupStalePresence(): Promise<void> {
    try {
      this.logger.log('Reconciling presence state in Redis on startup...');
      const keys = await this.redis.keys('presence:sockets:*');
      if (!keys || keys.length === 0) {
        this.logger.log('No existing presence socket keys found in Redis.');
        return;
      }

      const now = Date.now();
      const threshold = now - this.SOCKET_EXPIRY_MS;

      for (const key of keys) {
        const type = await this.redis.type(key);
        if (type === 'set') {
          // Legacy plain Set format containing stale sockets - delete immediately
          this.logger.log(`Removing legacy set presence key: ${key}`);
          await this.redis.del(key);
        } else if (type === 'zset') {
          await this.redis.zremrangebyscore(key, 0, threshold);
          const count = await this.redis.zcard(key);
          if (count === 0) {
            await this.redis.del(key);
          }
        } else {
          await this.redis.del(key);
        }
      }
      this.logger.log(`Startup presence reconciliation complete. Processed ${keys.length} keys.`);
    } catch (err: any) {
      this.logger.error(`Error during startup presence cleanup: ${err.message}`);
    }
  }

  /**
   * Canonical Redis key for tracking a user's active sockets (Sorted Set with timestamps).
   */
  private getUserSocketsKey(userId: string): string {
    return `presence:sockets:${userId}`;
  }

  /**
   * Redis key for storing last seen ISO timestamps.
   */
  private readonly LAST_SEEN_KEY = 'presence:last_seen';

  /**
   * Adds an authenticated socket connection for a user.
   * Cancels any pending grace timer.
   * Returns whether this is the user's first active connection (offline -> online transition).
   */
  async addSocket(userId: string, socketId: string): Promise<{ isFirstSocket: boolean }> {
    const key = this.getUserSocketsKey(userId);
    const now = Date.now();
    const threshold = now - this.SOCKET_EXPIRY_MS;

    // Remove legacy plain set key if present
    const type = await this.redis.type(key);
    if (type === 'set') {
      await this.redis.del(key);
    }

    // Prune expired sockets for this user
    await this.redis.zremrangebyscore(key, 0, threshold);
    const activeCountBefore = await this.redis.zcard(key);
    const hadGraceTimer = this.graceTimers.has(userId);

    if (hadGraceTimer) {
      clearTimeout(this.graceTimers.get(userId)!);
      this.graceTimers.delete(userId);
      this.logger.log(
        `Cancelled grace timer for user "${userId}" (reconnected via socket ${socketId})`,
      );
    }

    await this.redis.zadd(key, now, socketId);
    await this.redis.expire(key, 86400);

    const isFirstSocket = activeCountBefore === 0 && !hadGraceTimer;
    if (isFirstSocket) {
      this.logger.log(`User "${userId}" is now ONLINE (Socket: ${socketId})`);
    }

    return { isFirstSocket };
  }

  /**
   * Removes a socket connection for a user.
   * If remaining active sockets drop to 0, starts the 10-second grace timer (or marks offline immediately).
   * When grace period expires, marks user as officially offline and triggers onOffline callback.
   */
  async removeSocket(
    userId: string,
    socketId: string,
    onOffline: (lastSeen: string) => void,
    immediate = false,
  ): Promise<void> {
    const key = this.getUserSocketsKey(userId);
    const now = Date.now();
    const threshold = now - this.SOCKET_EXPIRY_MS;

    const type = await this.redis.type(key);
    if (type === 'set') {
      await this.redis.del(key);
    } else if (type === 'zset') {
      await this.redis.zrem(key, socketId);
      await this.redis.zremrangebyscore(key, 0, threshold);
    }

    // Verify local sockets if server is registered
    if (this.server) {
      const remainingSocketIds = await this.redis.zrange(key, 0, '-1');
      const localSockets = this.server.sockets?.sockets;
      for (const id of remainingSocketIds) {
        if (localSockets && !localSockets.has(id)) {
          await this.redis.zrem(key, id);
        }
      }
    }

    const count = await this.redis.zcard(key);
    this.logger.log(
      `Socket "${socketId}" disconnected for user "${userId}". Active sockets remaining: ${count}`,
    );

    if (count === 0) {
      if (this.graceTimers.has(userId)) {
        clearTimeout(this.graceTimers.get(userId)!);
        this.graceTimers.delete(userId);
      }

      const markOffline = async () => {
        // Prune expired sockets again before confirming offline status
        await this.redis.zremrangebyscore(key, 0, Date.now() - this.SOCKET_EXPIRY_MS);
        const finalCount = await this.redis.zcard(key);

        if (finalCount === 0) {
          const lastSeen = new Date().toISOString();
          await this.redis.hset(this.LAST_SEEN_KEY, userId, lastSeen);
          await this.redis.del(key);
          this.logger.log(
            `User "${userId}" is officially OFFLINE (lastSeen: ${lastSeen}).`,
          );

          onOffline(lastSeen);

          // Background sync to user-service for permanent storage in Postgres
          this.syncLastSeenToUserService(userId, lastSeen).catch((err) => {
            this.logger.warn(
              `Failed to sync lastSeen for user "${userId}" to user-service: ${err.message}`,
            );
          });
        } else {
          this.logger.log(
            `Grace timer expired for user "${userId}", but user reconnected (${finalCount} sockets). Staying online.`,
          );
        }
      };

      if (immediate) {
        await markOffline();
      } else {
        this.logger.log(
          `User "${userId}" has 0 active sockets. Starting 10-second grace period timer...`,
        );

        const timer = setTimeout(async () => {
          this.graceTimers.delete(userId);
          await markOffline();
        }, this.GRACE_PERIOD_MS);

        this.graceTimers.set(userId, timer);
      }
    }
  }

  /**
   * Retrieves single user presence status on demand.
   * If socket count > 0 or in grace period -> online.
   * Otherwise -> offline with lastSeen timestamp.
   */
  async getUserPresence(userId: string): Promise<UserPresenceResult> {
    const key = this.getUserSocketsKey(userId);
    const now = Date.now();
    const threshold = now - this.SOCKET_EXPIRY_MS;

    const type = await this.redis.type(key);
    if (type === 'set') {
      await this.redis.del(key);
    } else if (type === 'zset') {
      await this.redis.zremrangebyscore(key, 0, threshold);
      if (this.server) {
        const remaining = await this.redis.zrange(key, 0, '-1');
        const localSockets = this.server.sockets?.sockets;
        for (const sId of remaining) {
          if (localSockets && !localSockets.has(sId)) {
            await this.redis.zrem(key, sId);
          }
        }
      }
    }

    const count = await this.redis.zcard(key);
    const inGracePeriod = this.graceTimers.has(userId);

    if (count > 0 || inGracePeriod) {
      return {
        userId,
        isOnline: true,
        lastSeen: null,
      };
    }

    let lastSeen = await this.redis.hget(this.LAST_SEEN_KEY, userId);
    if (!lastSeen) {
      lastSeen = await this.fetchLastSeenFromUserService(userId);
    }

    return {
      userId,
      isOnline: false,
      lastSeen: lastSeen || null,
    };
  }

  /**
   * Calculates group online presence on demand for a list of member IDs.
   */
  async getGroupPresence(groupId: string, memberIds: string[]): Promise<GroupPresenceResult> {
    if (!memberIds || memberIds.length === 0) {
      return {
        groupId,
        totalMembers: 0,
        onlineCount: 0,
        onlineMemberIds: [],
      };
    }

    const now = Date.now();
    const threshold = now - this.SOCKET_EXPIRY_MS;
    const pipeline = this.redis.pipeline();

    for (const memberId of memberIds) {
      const key = this.getUserSocketsKey(memberId);
      pipeline.type(key);
      pipeline.zremrangebyscore(key, 0, threshold);
      pipeline.zcard(key);
    }

    const results = await pipeline.exec();
    const onlineMemberIds: string[] = [];

    memberIds.forEach((id, index) => {
      const typeResult = results?.[index * 3]?.[1];
      const countResult = results?.[index * 3 + 2]?.[1];
      let count = 0;
      if (typeResult === 'zset') {
        count = (countResult as number) || 0;
      }
      const inGrace = this.graceTimers.has(id);
      if (count > 0 || inGrace) {
        onlineMemberIds.push(id);
      }
    });

    return {
      groupId,
      totalMembers: memberIds.length,
      onlineCount: onlineMemberIds.length,
      onlineMemberIds,
    };
  }

  /**
   * Fetches lastSeenAt timestamp from user-service and caches it in Redis.
   */
  private async fetchLastSeenFromUserService(userId: string): Promise<string | null> {
    const user = await this.userServiceClient.getUserById(userId);
    const lastSeen = user?.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null;
    if (lastSeen) {
      await this.redis.hset(this.LAST_SEEN_KEY, userId, lastSeen);
    }
    return lastSeen;
  }

  /**
   * Asynchronously notifies user-service to update user's lastSeenAt in PostgreSQL.
   */
  private async syncLastSeenToUserService(userId: string, lastSeenAt: string): Promise<void> {
    await this.userServiceClient.updateLastSeen(userId, lastSeenAt);
  }
}
