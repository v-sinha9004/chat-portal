export interface QueryMessagesDto {
  limit?: string | number;
  before?: string;
  after?: string;
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

