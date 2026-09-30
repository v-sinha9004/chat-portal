import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  ConversationRead,
  ConversationReadDocument,
} from './schemas/conversation-read.schema';

export interface SaveMessageDto {
  type: 'direct' | 'group';
  messageId: string;
  conversationId: string;
  clientMessageId?: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  content: string;
  attachments?: any[];
  timestamp: string;
  isAnnouncement?: boolean;
  heading?: string;
  replyTo?: {
    messageId: string;
    senderId: string;
    text: string;
  };
  isDoubt?: boolean;
  doubtStatus?: 'OPEN' | 'RESOLVED';
  doubtTopic?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
}

export interface SaveLastReadDto {
  userId: string;
  conversationId: string;
  lastReadMessageId: string;
  lastReadAt?: string;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(ConversationRead.name)
    private readonly conversationReadModel: Model<ConversationReadDocument>,
  ) {}

  async saveMessage(dto: SaveMessageDto): Promise<MessageDocument> {
    try {
      const message = await this.messageModel.findOneAndUpdate(
        { messageId: dto.messageId },
        {
          $setOnInsert: {
            messageId: dto.messageId,
            conversationId: dto.conversationId,
            clientMessageId: dto.clientMessageId,
            type: dto.type,
            senderId: dto.senderId,
            recipientId: dto.recipientId,
            groupId: dto.groupId,
            content: dto.content,
            attachments: dto.attachments || [],
            status: 'sent',
            timestamp: new Date(dto.timestamp),
            isAnnouncement: dto.isAnnouncement || false,
            heading: dto.heading,
            replyTo: dto.replyTo,
            isDoubt: dto.isDoubt || false,
            doubtStatus: dto.isDoubt ? (dto.doubtStatus || 'OPEN') : undefined,
            doubtTopic: dto.doubtTopic,
            resolvedBy: dto.resolvedBy,
            resolvedByName: dto.resolvedByName,
            resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : undefined,
          },
        },
        { upsert: true, new: true },
      );

      this.logger.log(
        `Successfully persisted ${dto.type} message [${dto.messageId}] to MongoDB`,
      );
      return message;
    } catch (error: any) {
      if (error.code === 11000) {
        this.logger.warn(
          `Message [${dto.messageId}] already exists in MongoDB, skipping (idempotent duplicate)`,
        );
        return (await this.messageModel.findOne({ messageId: dto.messageId }))!;
      }
      this.logger.error(
        `Failed to persist message [${dto.messageId}] to MongoDB: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async saveLastRead(dto: SaveLastReadDto): Promise<ConversationReadDocument> {
    try {
      const readAt = dto.lastReadAt ? new Date(dto.lastReadAt) : new Date();
      const result = await this.conversationReadModel.findOneAndUpdate(
        { conversationId: dto.conversationId, userId: dto.userId },
        {
          $set: {
            lastReadMessageId: dto.lastReadMessageId,
            lastReadAt: readAt,
            unreadCount: 0,
          },
        },
        { upsert: true, new: true },
      );

      this.logger.log(
        `Successfully persisted lastRead [${dto.lastReadMessageId}] for user [${dto.userId}] in convo [${dto.conversationId}] to MongoDB`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(
        `Failed to persist lastRead for user [${dto.userId}] in convo [${dto.conversationId}]: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
