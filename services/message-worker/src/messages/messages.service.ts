import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';

export interface SaveMessageDto {
  type: 'direct' | 'group';
  messageId: string;
  conversationId: string;
  clientMessageId?: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  content: string;
  timestamp: string;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
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
            status: 'sent',
            timestamp: new Date(dto.timestamp),
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
}
