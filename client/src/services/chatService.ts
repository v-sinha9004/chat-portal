import type { ReplyToInfo, PinnedMessage } from '../types';

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
  const queryParams = new URLSearchParams({
    messageId,
    surrounding: String(surrounding),
  });

  const response = await fetch(`${CHAT_API_URL}/messages/context?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to fetch message context: HTTP ${response.status}`,
    );
  }

  return response.json();
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

  const queryParams = new URLSearchParams();
  if (options.limit !== undefined) {
    queryParams.set('limit', String(options.limit));
  }
  if (options.before) {
    queryParams.set('before', options.before);
  }
  if (options.after) {
    queryParams.set('after', options.after);
  }
  const queryString = queryParams.toString();
  const url = `${CHAT_API_URL}/messages/direct/${encodeURIComponent(targetUserId)}${
    queryString ? `?${queryString}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal: options.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to fetch direct messages: HTTP ${response.status}`,
    );
  }

  return response.json();
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

  const queryParams = new URLSearchParams();
  if (options.limit !== undefined) {
    queryParams.set('limit', String(options.limit));
  }
  if (options.before) {
    queryParams.set('before', options.before);
  }
  if (options.after) {
    queryParams.set('after', options.after);
  }
  const queryString = queryParams.toString();
  const url = `${CHAT_API_URL}/messages/group/${encodeURIComponent(groupId)}${
    queryString ? `?${queryString}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal: options.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to fetch group messages: HTTP ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Fetch real-time unread message counts for all conversations for the authenticated user.
 */
export async function fetchUnreadCounts(
  token: string,
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const response = await fetch(`${CHAT_API_URL}/messages/unread-counts`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to fetch unread counts: HTTP ${response.status}`,
    );
  }

  const data = await response.json();
  return data?.unreadCounts || {};
}

export interface DoubtsApiResponse {
  conversationId: string;
  doubts: ChatHistoryMessage[];
  total: number;
  openCount: number;
  resolvedCount: number;
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
  const queryParams = new URLSearchParams({ conversationId });
  if (status && status !== 'ALL') {
    queryParams.set('status', status);
  }
  const response = await fetch(`${CHAT_API_URL}/messages/doubts?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to fetch doubts: HTTP ${response.status}`,
    );
  }

  return response.json();
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
  const response = await fetch(
    `${CHAT_API_URL}/messages/${encodeURIComponent(messageId)}/doubt-status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ conversationId, status }),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to update doubt status: HTTP ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Fetch active pinned messages for a specific conversation.
 */
export async function fetchPinnedMessages(
  token: string,
  conversationId: string,
  signal?: AbortSignal,
): Promise<PinnedMessage[]> {
  const queryParams = new URLSearchParams({ conversationId });
  const response = await fetch(`${CHAT_API_URL}/messages/pins?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to fetch pinned messages: HTTP ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Pin a message in a conversation.
 */
export async function pinMessageRest(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<PinnedMessage> {
  const response = await fetch(
    `${CHAT_API_URL}/messages/${encodeURIComponent(messageId)}/pin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ conversationId }),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to pin message: HTTP ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Unpin a message in a conversation.
 */
export async function unpinMessageRest(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<void> {
  const queryParams = new URLSearchParams({ conversationId });
  const response = await fetch(
    `${CHAT_API_URL}/messages/${encodeURIComponent(messageId)}/pin?${queryParams.toString()}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to unpin message: HTTP ${response.status}`,
    );
  }
}

