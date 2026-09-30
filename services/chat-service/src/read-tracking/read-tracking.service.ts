import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  ConversationRead,
  ConversationReadDocument,
} from '../messages/schemas/conversation-read.schema';

@Injectable()
export class ReadTrackingService implements OnModuleDestroy {
  private readonly logger = new Logger(ReadTrackingService.name);
  private readonly redis: Redis;
  private readonly TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days sliding TTL

  constructor(
    @InjectModel(ConversationRead.name)
    private readonly conversationReadModel: Model<ConversationReadDocument>,
  ) {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.redis = new Redis({
      host,
      port,
      lazyConnect: false,
    });

    this.redis.on('connect', () => {
      this.logger.log(`Connected to Redis for ReadTracking on ${host}:${port}`);
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis ReadTracking error: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private getUnreadKey(userId: string): string {
    return `unreadcount:${userId}`;
  }

  private getLastReadKey(userId: string): string {
    return `lastread:${userId}`;
  }

  /**
   * Increments unread count for a single user in a conversation (e.g. direct message recipient).
   * Runs in O(1) in Redis RAM (~0.1ms).
   */
  async incrementUnreadCount(
    userId: string,
    conversationId: string,
  ): Promise<number> {
    const key = this.getUnreadKey(userId);
    const newCount = await this.redis.hincrby(key, conversationId, 1);
    await this.redis.expire(key, this.TTL_SECONDS);
    return newCount;
  }

  /**
   * Batch increments unread count for multiple users in a conversation (e.g. group message members).
   * Uses Redis pipeline to execute all increments in a single network round-trip (< 1ms).
   */
  async incrementUnreadCountBatch(
    userIds: string[],
    conversationId: string,
  ): Promise<void> {
    if (!userIds || userIds.length === 0) return;

    const pipeline = this.redis.pipeline();
    for (const userId of userIds) {
      const key = this.getUnreadKey(userId);
      pipeline.hincrby(key, conversationId, 1);
      pipeline.expire(key, this.TTL_SECONDS);
    }
    await pipeline.exec();
  }

  /**
   * Fetches all unread counts for a user across all their conversations.
   * Checks Redis first. On cache miss, falls back to MongoDB and repopulates Redis.
   */
  async getUnreadCounts(userId: string): Promise<Record<string, number>> {
    const key = this.getUnreadKey(userId);
    const raw = await this.redis.hgetall(key);

    if (raw && Object.keys(raw).length > 0) {
      const result: Record<string, number> = {};
      for (const [convoId, countStr] of Object.entries(raw)) {
        const count = parseInt(countStr, 10);
        if (!isNaN(count) && count > 0) {
          result[convoId] = count;
        }
      }
      return result;
    }

    // Cache miss / cold start: recover from MongoDB conversation_reads
    this.logger.log(
      `Unread counts cache miss for user "${userId}". Rehydrating from MongoDB...`,
    );
    const docs = await this.conversationReadModel
      .find({ userId, unreadCount: { $gt: 0 } })
      .lean()
      .exec();

    const result: Record<string, number> = {};
    if (docs.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const doc of docs) {
        pipeline.hset(key, doc.conversationId, doc.unreadCount);
        result[doc.conversationId] = doc.unreadCount;
      }
      pipeline.expire(key, this.TTL_SECONDS);
      await pipeline.exec();
    }

    return result;
  }

  /**
   * Resets unread count to 0 and updates lastReadMessageId in Redis.
   * Executed when a user opens or reads a chat.
   */
  async resetUnreadAndSetLastRead(
    userId: string,
    conversationId: string,
    lastReadMessageId: string,
  ): Promise<void> {
    const unreadKey = this.getUnreadKey(userId);
    const lastReadKey = this.getLastReadKey(userId);

    const pipeline = this.redis.pipeline();
    pipeline.hdel(unreadKey, conversationId);
    if (lastReadMessageId) {
      pipeline.hset(lastReadKey, conversationId, lastReadMessageId);
      pipeline.expire(lastReadKey, this.TTL_SECONDS);
    }
    await pipeline.exec();
  }

  /**
   * Retrieves the last read message ID for a user in a conversation.
   */
  async getLastRead(
    userId: string,
    conversationId: string,
  ): Promise<string | null> {
    const lastReadKey = this.getLastReadKey(userId);
    const cached = await this.redis.hget(lastReadKey, conversationId);
    if (cached) return cached;

    // Fallback to MongoDB
    const doc = await this.conversationReadModel
      .findOne({ userId, conversationId })
      .lean()
      .exec();
    return doc?.lastReadMessageId || null;
  }
}
