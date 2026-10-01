import { AttachmentResponse } from './message-response.interface';

export interface PinnedMessageSnapshotDto {
  senderId: string;
  senderName?: string;
  content: string;
  heading?: string;
  isAnnouncement?: boolean;
  isDoubt?: boolean;
  doubtStatus?: 'OPEN' | 'RESOLVED';
  doubtTopic?: string;
  timestamp: string;
  attachments?: AttachmentResponse[];
}

export interface PinnedMessageResponse {
  id: string;
  conversationId: string;
  messageId: string;
  pinnedBy: string;
  pinnedByName?: string;
  pinnedAt: string;
  snapshot: PinnedMessageSnapshotDto;
}
