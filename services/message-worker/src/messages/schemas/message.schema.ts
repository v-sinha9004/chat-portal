import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

export interface Attachment {
  fileId: string;
  type: 'image' | 'file';
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  blurhash?: string;
}

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ required: true, unique: true, index: true })
  messageId: string;

  @Prop({ required: true })
  conversationId: string;

  @Prop({ index: true, sparse: true })
  clientMessageId?: string;

  @Prop({ required: true, enum: ['direct', 'group'] })
  type: 'direct' | 'group';

  @Prop({ required: true })
  senderId: string;

  @Prop()
  recipientId?: string;

  @Prop()
  groupId?: string;

  @Prop({ default: '' })
  content: string;

  @Prop({
    type: [
      {
        fileId: { type: String, required: true },
        type: { type: String, required: true, enum: ['image', 'file'] },
        url: { type: String, required: true },
        thumbnailUrl: { type: String, required: false },
        fileName: { type: String, required: true },
        fileSize: { type: Number, required: true },
        mimeType: { type: String, required: true },
        width: { type: Number, required: false },
        height: { type: Number, required: false },
        blurhash: { type: String, required: false },
      },
    ],
    default: [],
    _id: false,
  })
  attachments?: Attachment[];

  @Prop({ default: 'sent', enum: ['sent', 'delivered', 'read'] })
  status: string;

  @Prop({ default: false, index: true })
  isAnnouncement?: boolean;

  @Prop()
  heading?: string;

  @Prop({
    type: {
      messageId: { type: String, required: true },
      senderId: { type: String, required: true },
      text: { type: String, required: true },
    },
    _id: false,
    required: false,
  })
  replyTo?: {
    messageId: string;
    senderId: string;
    text: string;
  };

  @Prop({ default: false, index: true })
  isDoubt?: boolean;

  @Prop({ enum: ['OPEN', 'RESOLVED'], index: true })
  doubtStatus?: 'OPEN' | 'RESOLVED';

  @Prop()
  doubtTopic?: string;

  @Prop()
  resolvedBy?: string;

  @Prop()
  resolvedByName?: string;

  @Prop()
  resolvedAt?: Date;

  @Prop({ required: true })
  timestamp: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Optimized compound index for all conversation history and cursor pagination queries
MessageSchema.index({ conversationId: 1, messageId: -1 });
MessageSchema.index({ 'replyTo.messageId': 1 }, { sparse: true });
MessageSchema.index({ conversationId: 1, isDoubt: 1, doubtStatus: 1 });
