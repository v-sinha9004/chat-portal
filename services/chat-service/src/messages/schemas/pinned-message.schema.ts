import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PinnedMessageDocument = PinnedMessage & Document;

@Schema({ _id: false })
export class PinnedMessageSnapshot {
  @Prop({ required: true })
  senderId: string;

  @Prop()
  senderName?: string;

  @Prop({ required: true })
  content: string;

  @Prop()
  heading?: string;

  @Prop({ default: false })
  isAnnouncement?: boolean;

  @Prop({ default: false })
  isDoubt?: boolean;

  @Prop({ enum: ['OPEN', 'RESOLVED'] })
  doubtStatus?: 'OPEN' | 'RESOLVED';

  @Prop()
  doubtTopic?: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ type: Array, default: [] })
  attachments?: any[];
}

@Schema({ timestamps: true, collection: 'pinned_messages' })
export class PinnedMessage {
  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ required: true, index: true })
  messageId: string;

  @Prop({ required: true })
  pinnedBy: string;

  @Prop()
  pinnedByName?: string;

  @Prop({ required: true, default: () => new Date() })
  pinnedAt: Date;

  @Prop({ type: PinnedMessageSnapshot, required: true })
  snapshot: PinnedMessageSnapshot;
}

export const PinnedMessageSchema = SchemaFactory.createForClass(PinnedMessage);

PinnedMessageSchema.index({ conversationId: 1, messageId: 1 }, { unique: true });
PinnedMessageSchema.index({ conversationId: 1, pinnedAt: -1 });
