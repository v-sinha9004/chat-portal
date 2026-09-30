import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

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

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis: Redis;
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();
  private readonly GRACE_PERIOD_MS = 10000; // 10-second tunnel grace period

  constructor() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.redis = new Redis({
      host,
      port,
      lazyConnect: false,
    });

    this.redis.on('connect', () => {
      this.logger.log(`Connected to Redis for presence on ${host}:${port}`);
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis Presence error: ${err.message}`);
    });
  }

  onModuleDestroy() {
    for (const timer of this.graceTimers.values()) {
      clearTimeout(timer);
    }
    this.graceTimers.clear();
    this.redis.disconnect();
  }

  /**
   * Canonical Redis key for tracking a user's active socket IDs.
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
    if (this.graceTimers.has(userId)) {
      clearTimeout(this.graceTimers.get(userId)!);
      this.graceTimers.delete(userId);
      this.logger.log(
        `Cancelled 10s grace timer for user "${userId}" (reconnected via socket ${socketId})`,
      );
    }

    const key = this.getUserSocketsKey(userId);
    await this.redis.sadd(key, socketId);
    const count = await this.redis.scard(key);

    const isFirstSocket = count === 1;
    if (isFirstSocket) {
      this.logger.log(`User "${userId}" is now ONLINE (Socket: ${socketId})`);
    }

    return { isFirstSocket };
  }

  /**
   * Removes a socket connection for a user.
   * If remaining active sockets drop to 0, starts the 10-second grace timer.
   * If no reconnection happens within 10s, marks user as officially offline.
   */
  async removeSocket(
    userId: string,
    socketId: string,
    onOffline: (lastSeen: string) => void,
  ): Promise<void> {
    const key = this.getUserSocketsKey(userId);
    await this.redis.srem(key, socketId);
    const count = await this.redis.scard(key);

    this.logger.log(
      `Socket "${socketId}" disconnected for user "${userId}". Active sockets remaining: ${count}`,
    );

    if (count === 0) {
      if (this.graceTimers.has(userId)) {
        clearTimeout(this.graceTimers.get(userId)!);
      }

      this.logger.log(
        `User "${userId}" has 0 active sockets. Starting 10-second grace period timer...`,
      );

      const timer = setTimeout(async () => {
        this.graceTimers.delete(userId);

        // Check Redis again in case user reconnected on another node
        const finalCount = await this.redis.scard(key);
        if (finalCount === 0) {
          const lastSeen = new Date().toISOString();
          await this.redis.hset(this.LAST_SEEN_KEY, userId, lastSeen);
          this.logger.log(
            `Grace period expired for user "${userId}". Officially OFFLINE (lastSeen: ${lastSeen}).`,
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
      }, this.GRACE_PERIOD_MS);

      this.graceTimers.set(userId, timer);
    }
  }

  /**
   * Retrieves single user presence status on demand.
   * If socket count > 0 or in grace period -> online.
   * Otherwise -> offline with lastSeen timestamp.
   */
  async getUserPresence(userId: string): Promise<UserPresenceResult> {
    const key = this.getUserSocketsKey(userId);
    const count = await this.redis.scard(key);
    const inGracePeriod = this.graceTimers.has(userId);

    if (count > 0 || inGracePeriod) {
      return {
        userId,
        isOnline: true,
        lastSeen: null,
      };
    }

    const lastSeen = await this.redis.hget(this.LAST_SEEN_KEY, userId);
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

    const pipeline = this.redis.pipeline();
    for (const memberId of memberIds) {
      pipeline.scard(this.getUserSocketsKey(memberId));
    }

    const results = await pipeline.exec();
    const onlineMemberIds: string[] = [];

    memberIds.forEach((id, index) => {
      const count = (results?.[index]?.[1] as number) || 0;
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
   * Asynchronously notifies user-service to update user's lastSeenAt in PostgreSQL.
   */
  private async syncLastSeenToUserService(userId: string, lastSeenAt: string): Promise<void> {
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
    const url = `${userServiceUrl}/api/users/${encodeURIComponent(userId)}/last-seen`;

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lastSeenAt }),
      });

      if (!response.ok) {
        this.logger.warn(
          `User service returned HTTP ${response.status} when updating last-seen for ${userId}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Could not contact user-service to update last-seen: ${err.message}`);
    }
  }
}
