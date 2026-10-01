import type { User } from './auth';
import type { AttachmentInfo, ReplyToInfo } from './chat';

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user?: User | null;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  myRole?: 'ADMIN' | 'MEMBER';
  members?: GroupMember[];
}

export type ActiveConversation =
  | { type: 'direct'; id: string; user: User }
  | { type: 'group'; id: string; group: Group };

export interface UnreadCountsResponse {
  status: string;
  unreadCounts: Record<string, number>;
}

export interface ConversationHistoryResponse {
  conversationId: string;
  groupId?: string;
  partnerLastReadMessageId?: string | null;
  memberLastReadMap?: Record<string, string>;
  messages: Array<{
    id: string;
    messageId?: string;
    conversationId?: string;
    clientMessageId?: string;
    senderId: string;
    recipientId?: string;
    groupId?: string;
    text?: string;
    content?: string;
    attachments?: AttachmentInfo[];
    timestamp: string;
    status?: string;
    isAnnouncement?: boolean;
    heading?: string;
    replyTo?: ReplyToInfo;
    isDoubt?: boolean;
    doubtStatus?: 'OPEN' | 'RESOLVED';
    doubtTopic?: string;
    resolvedBy?: string;
    resolvedByName?: string;
    resolvedAt?: string;
  }>;
  hasMore: boolean;
  oldestCursor?: string;
}

export function getDirectConversationId(userId1: string, userId2: string): string {
  return `direct:${[userId1, userId2].sort().join(':')}`;
}

export function getGroupConversationId(groupId: string): string {
  return `group:${groupId}`;
}
