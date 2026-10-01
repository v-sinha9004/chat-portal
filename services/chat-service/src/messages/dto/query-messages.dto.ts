export interface QueryMessagesDto {
  limit?: string | number;
  before?: string;
  after?: string;
}

export interface AttachmentResponse {
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

export interface ChatMessageResponse {
  id: string;
  messageId: string;
  conversationId: string;
  clientMessageId?: string;
  type: 'direct' | 'group';
  senderId: string;
  recipientId?: string;
  groupId?: string;
  text: string;
  content: string;
  attachments?: AttachmentResponse[];
  status: string;
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

export interface QueryDoubtsDto {
  conversationId: string;
  status?: 'OPEN' | 'RESOLVED' | 'ALL';
  limit?: string | number;
}

export interface DoubtsListResponse {
  conversationId: string;
  doubts: ChatMessageResponse[];
  total: number;
  openCount: number;
  resolvedCount: number;
}

export interface ConversationHistoryResponse {
  conversationId: string;
  groupId?: string;
  partnerLastReadMessageId?: string | null;
  memberLastReadMap?: Record<string, string>;
  messages: ChatMessageResponse[];
  hasMore: boolean;
  hasNewer?: boolean;
  oldestCursor?: string;
  newestCursor?: string;
}

export interface QueryMessageContextDto {
  messageId: string;
  surrounding?: string | number;
}

export interface MessageContextResponse {
  conversationId: string;
  targetMessageId: string;
  messages: ChatMessageResponse[];
  hasOlder: boolean;
  hasNewer: boolean;
  oldestCursor?: string;
  newestCursor?: string;
  partnerLastReadMessageId?: string | null;
  memberLastReadMap?: Record<string, string>;
}

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

export interface PinMessageDto {
  conversationId: string;
}

export interface ReportMessageDto {
  reason?: string;
}

export interface QueryReportsDto {
  status?: string;
  limit?: string | number;
  page?: string | number;
}

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


