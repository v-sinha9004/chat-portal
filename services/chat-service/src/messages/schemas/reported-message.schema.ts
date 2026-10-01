import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReportedMessageDocument = ReportedMessage & Document;

@Schema({ _id: false })
export class ReportedMessageSnapshot {
  @Prop({ required: true })
  messageId: string;

  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true })
  senderId: string;

  @Prop()
  recipientId?: string;

  @Prop()
  groupId?: string;

  @Prop({ required: true, enum: ['direct', 'group'] })
  type: 'direct' | 'group';

  @Prop({ default: '' })
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

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ type: Array, default: [] })
  attachments?: any[];
}

@Schema({ timestamps: true, collection: 'reported_messages' })
export class ReportedMessage {
  @Prop({ required: true, index: true })
  messageId: string;

  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ required: true, index: true })
  reportedBy: string;

  @Prop({ type: String, default: null })
  reason?: string;

  @Prop({ default: 'PENDING', enum: ['PENDING', 'REVIEWED', 'DISMISSED'], index: true })
  status: string;

  @Prop({ type: ReportedMessageSnapshot, required: true })
  message: ReportedMessageSnapshot;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ReportedMessageSchema = SchemaFactory.createForClass(ReportedMessage);

ReportedMessageSchema.index({ messageId: 1, reportedBy: 1 }, { unique: true });
ReportedMessageSchema.index({ createdAt: -1 });
