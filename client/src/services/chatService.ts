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
}

export interface ChatHistoryResponse {
  conversationId: string;
  groupId?: string;
  messages: ChatHistoryMessage[];
  hasMore: boolean;
  oldestCursor?: string;
}

/**
 * Fetch direct message history between current authenticated user and target user.
 */
export async function fetchDirectMessages(
  token: string,
  targetUserId: string,
  signal?: AbortSignal,
): Promise<ChatHistoryResponse> {
  const response = await fetch(
    `${CHAT_API_URL}/messages/direct/${encodeURIComponent(targetUserId)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
    },
  );

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
  signal?: AbortSignal,
): Promise<ChatHistoryResponse> {
  const response = await fetch(
    `${CHAT_API_URL}/messages/group/${encodeURIComponent(groupId)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.message || `Failed to fetch group messages: HTTP ${response.status}`,
    );
  }

  return response.json();
}
