import { AttachmentResponse } from './message-response.interface';

export interface ReportedMessageSnapshotDto {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  type: 'direct' | 'group';
  content: string;
  heading?: string;
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
  senderName?: string;
  reason?: string;
  status: string;
  createdAt: string;
  message: ReportedMessageSnapshotDto;
}

export interface ReportsListResponse {
  status: string;
  total: number;
  page: number;
  limit: number;
  reports: ReportedMessageResponse[];
}
