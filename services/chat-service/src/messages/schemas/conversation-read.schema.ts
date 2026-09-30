import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationReadDocument = ConversationRead & Document;

@Schema({ timestamps: true, collection: 'conversation_reads' })
export class ConversationRead {
  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ default: '' })
  lastReadMessageId: string;

  @Prop({ default: () => new Date() })
  lastReadAt: Date;

  @Prop({ default: 0, min: 0 })
  unreadCount: number;
}

export const ConversationReadSchema =
  SchemaFactory.createForClass(ConversationRead);

// Ensure one read state record per (conversation, user)
ConversationReadSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true },
);

// Fast index for user's unread conversations lookup
ConversationReadSchema.index({ userId: 1, unreadCount: 1 });
