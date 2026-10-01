import { AttachmentResponse } from './message-response.interface';

export interface ReportedMessageSnapshotDto {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  type: 'direct' | 'group';
  content: string;
  text?: string;
  heading?: string;
  replyTo?: {
    messageId: string;
    senderId: string;
    text: string;
  };
  isAnnouncement?: boolean;
  isDoubt?: boolean;
  doubtStatus?: 'OPEN' | 'RESOLVED';
  doubtTopic?: string;
  timestamp: string;
  attachments?: AttachmentResponse[];
}

export interface ReportedMessageResponse {
  id: string;
  messageId: string;
  conversationId: string;
  reportedBy: string;
  reporterName?: string;
  reportedByName?: string;
  senderName?: string;
  reason?: string;
  status: string;
  createdAt: string;
  reportedAt?: string;
  message: ReportedMessageSnapshotDto;
}

export interface ReportsListResponse {
  status: string;
  total: number;
  page: number;
  limit: number;
  reports: ReportedMessageResponse[];
}
