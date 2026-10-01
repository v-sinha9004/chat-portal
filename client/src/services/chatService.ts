import type { ReplyToInfo, PinnedMessage, AttachmentInfo, ReportsListResponse } from '@/types';
import { apiClient } from '@/utils/httpClient';

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || '/api/chat';

export interface ChatHistoryMessage {
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
  attachments?: AttachmentInfo[];
  status: string;
  timestamp: string;
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

export interface ChatHistoryResponse {
  conversationId: string;
  groupId?: string;
  partnerLastReadMessageId?: string | null;
  memberLastReadMap?: Record<string, string>;
  messages: ChatHistoryMessage[];
  hasMore: boolean;
  hasNewer?: boolean;
  oldestCursor?: string;
  newestCursor?: string;
}

export interface FetchMessagesOptions {
  limit?: number;
  before?: string;
  after?: string;
  signal?: AbortSignal;
}

export interface MessageContextResponse {
  conversationId: string;
  targetMessageId: string;
  messages: ChatHistoryMessage[];
  hasOlder: boolean;
  hasNewer: boolean;
  oldestCursor?: string;
  newestCursor?: string;
  partnerLastReadMessageId?: string | null;
  memberLastReadMap?: Record<string, string>;
}

export interface DoubtsApiResponse {
  conversationId: string;
  doubts: ChatHistoryMessage[];
  total: number;
  openCount: number;
  resolvedCount: number;
}

export interface ReportMessageResponse {
  status: string;
  message: string;
  reportId: string;
}

/**
 * Fetch a slice of messages surrounding a specific messageId.
 * Modular primitive used by reply quotes, pinned messages, and search jumps.
 */
export async function fetchMessageContext(
  token: string,
  messageId: string,
  surrounding = 25,
  signal?: AbortSignal,
): Promise<MessageContextResponse> {
  return apiClient.get<MessageContextResponse>(`${CHAT_API_URL}/messages/context`, {
    token,
    signal,
    params: {
      messageId,
      surrounding,
    },
  });
}

/**
 * Fetch direct message history between current authenticated user and target user.
 */
export async function fetchDirectMessages(
  token: string,
  targetUserId: string,
  optionsOrSignal?: FetchMessagesOptions | AbortSignal,
): Promise<ChatHistoryResponse> {
  const options: FetchMessagesOptions =
    optionsOrSignal instanceof AbortSignal
      ? { signal: optionsOrSignal }
      : optionsOrSignal || {};

  return apiClient.get<ChatHistoryResponse>(
    `${CHAT_API_URL}/messages/direct/${encodeURIComponent(targetUserId)}`,
    {
      token,
      signal: options.signal,
      params: {
        limit: options.limit,
        before: options.before,
        after: options.after,
      },
    },
  );
}

/**
 * Fetch group message history for an authorized group member.
 */
export async function fetchGroupMessages(
  token: string,
  groupId: string,
  optionsOrSignal?: FetchMessagesOptions | AbortSignal,
): Promise<ChatHistoryResponse> {
  const options: FetchMessagesOptions =
    optionsOrSignal instanceof AbortSignal
      ? { signal: optionsOrSignal }
      : optionsOrSignal || {};

  return apiClient.get<ChatHistoryResponse>(
    `${CHAT_API_URL}/messages/group/${encodeURIComponent(groupId)}`,
    {
      token,
      signal: options.signal,
      params: {
        limit: options.limit,
        before: options.before,
        after: options.after,
      },
    },
  );
}

/**
 * Fetch real-time unread message counts for all conversations for the authenticated user.
 */
export async function fetchUnreadCounts(
  token: string,
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const data = await apiClient.get<{ unreadCounts: Record<string, number> }>(
    `${CHAT_API_URL}/messages/unread-counts`,
    {
      token,
      signal,
    },
  );

  return data?.unreadCounts || {};
}

/**
 * Fetch doubts for a specific conversation (open/resolved/all).
 */
export async function fetchDoubts(
  token: string,
  conversationId: string,
  status?: 'OPEN' | 'RESOLVED' | 'ALL',
  signal?: AbortSignal,
): Promise<DoubtsApiResponse> {
  return apiClient.get<DoubtsApiResponse>(`${CHAT_API_URL}/messages/doubts`, {
    token,
    signal,
    params: {
      conversationId,
      status: status && status !== 'ALL' ? status : undefined,
    },
  });
}

/**
 * Update doubt resolution status via REST fallback.
 */
export async function updateDoubtStatusRest(
  token: string,
  messageId: string,
  conversationId: string,
  status: 'OPEN' | 'RESOLVED',
): Promise<ChatHistoryMessage> {
  return apiClient.patch<ChatHistoryMessage>(
    `${CHAT_API_URL}/messages/${encodeURIComponent(messageId)}/doubt-status`,
    { conversationId, status },
    { token },
  );
}

/**
 * Fetch active pinned messages for a specific conversation.
 */
export async function fetchPinnedMessages(
  token: string,
  conversationId: string,
  signal?: AbortSignal,
): Promise<PinnedMessage[]> {
  return apiClient.get<PinnedMessage[]>(`${CHAT_API_URL}/messages/pins`, {
    token,
    signal,
    params: { conversationId },
  });
}

/**
 * Pin a message in a conversation.
 */
export async function pinMessageRest(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<PinnedMessage> {
  return apiClient.post<PinnedMessage>(
    `${CHAT_API_URL}/messages/${encodeURIComponent(messageId)}/pin`,
    { conversationId },
    { token },
  );
}

/**
 * Unpin a message in a conversation.
 */
export async function unpinMessageRest(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<void> {
  return apiClient.delete<void>(
    `${CHAT_API_URL}/messages/${encodeURIComponent(messageId)}/pin`,
    {
      token,
      params: { conversationId },
    },
  );
}

/**
 * Report a message in a conversation.
 */
export async function reportMessageRest(
  token: string,
  messageId: string,
  reason?: string,
): Promise<ReportMessageResponse> {
  return apiClient.post<ReportMessageResponse>(
    `${CHAT_API_URL}/messages/${encodeURIComponent(messageId)}/report`,
    reason ? { reason } : {},
    { token },
  );
}

/**
 * Fetch reported messages (Admin only).
 */
export async function fetchReportedMessages(
  token: string,
  params?: { page?: number; limit?: number; status?: string },
  signal?: AbortSignal,
): Promise<ReportsListResponse> {
  return apiClient.get<ReportsListResponse>(`${CHAT_API_URL}/messages/reports`, {
    token,
    signal,
    params,
  });
}
