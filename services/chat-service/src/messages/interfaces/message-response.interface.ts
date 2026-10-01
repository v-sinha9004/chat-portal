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
