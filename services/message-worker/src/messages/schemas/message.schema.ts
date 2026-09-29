import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ required: true, unique: true, index: true })
  messageId: string;

  @Prop({ index: true, sparse: true })
  clientMessageId?: string;

  @Prop({ required: true, enum: ['direct', 'group'], index: true })
  type: 'direct' | 'group';

  @Prop({ required: true, index: true })
  senderId: string;

  @Prop({ index: true })
  recipientId?: string;

  @Prop({ index: true })
  groupId?: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 'sent', enum: ['sent', 'delivered', 'read'] })
  status: string;

  @Prop({ required: true, index: true })
  timestamp: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound indexes for optimized conversation history queries
MessageSchema.index({ senderId: 1, recipientId: 1, timestamp: -1 });
MessageSchema.index({ recipientId: 1, senderId: 1, timestamp: -1 });
MessageSchema.index({ groupId: 1, timestamp: -1 });
