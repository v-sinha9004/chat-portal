export interface ReplyToInfo {
  messageId: string;
  senderId: string;
  text: string;
}

export interface AttachmentInfo {
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

export interface ChatMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  senderName?: string;
  text: string;
  attachments?: AttachmentInfo[];
  timestamp: string;
  clientMessageId?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isAnnouncement?: boolean;
  heading?: string;
  replyTo?: ReplyToInfo;
  isDoubt?: boolean;
  doubtStatus?: 'OPEN' | 'RESOLVED';
  doubtTopic?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
}

export interface UpdateDoubtStatusPayload {
  conversationId: string;
  messageId: string;
  status: 'OPEN' | 'RESOLVED';
}

export interface DoubtStatusChangedEvent {
  conversationId: string;
  messageId: string;
  status: 'OPEN' | 'RESOLVED';
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
}

export interface DoubtsListResponse {
  conversationId: string;
  doubts: ChatMessage[];
  total: number;
  openCount: number;
  resolvedCount: number;
}

export interface PinnedMessageSnapshot {
  senderId: string;
  senderName?: string;
  content: string;
  heading?: string;
  isAnnouncement?: boolean;
  isDoubt?: boolean;
  doubtStatus?: 'OPEN' | 'RESOLVED';
  doubtTopic?: string;
  timestamp: string;
  attachments?: AttachmentInfo[];
}

export interface PinnedMessage {
  id: string;
  conversationId: string;
  messageId: string;
  pinnedBy: string;
  pinnedByName?: string;
  pinnedAt: string;
  snapshot: PinnedMessageSnapshot;
}

export interface MessagePinnedSocketEvent {
  conversationId: string;
  pin: PinnedMessage;
}

export interface MessageUnpinnedSocketEvent {
  conversationId: string;
  messageId: string;
}

export interface ReportedMessageSnapshot {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  type: 'direct' | 'group';
  content: string;
  text?: string;
  heading?: string;
  replyTo?: ReplyToInfo;
  isAnnouncement?: boolean;
  isDoubt?: boolean;
  doubtStatus?: 'OPEN' | 'RESOLVED';
  doubtTopic?: string;
  timestamp: string;
  attachments?: AttachmentInfo[];
}

export interface ReportedMessageItem {
  id: string;
  messageId: string;
  conversationId: string;
  reportedBy: string;
  reporterName?: string;
  reportedByName?: string;
  senderName?: string;
  reason?: string;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | string;
  createdAt: string;
  reportedAt?: string;
  message: ReportedMessageSnapshot;
}

export interface ReportsListResponse {
  status: string;
  total: number;
  page: number;
  limit: number;
  reports: ReportedMessageItem[];
}
