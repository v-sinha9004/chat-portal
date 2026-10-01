import type { ChatMessage, ConversationHistoryResponse } from '@/types';

export function mapHistoryMessageToChatMessage(
  m: ConversationHistoryResponse['messages'][number],
  currentUserId: string | null,
  isGroup: boolean,
  partnerLastRead?: string | null,
  memberLastReadMap: Record<string, string> = {},
): ChatMessage {
  const msgId = m.id || m.messageId || '';
  const isMe = m.senderId === currentUserId;
  const formattedTime = new Date(m.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  let status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' = 'sent';
  if (isMe) {
    if (!isGroup && partnerLastRead && msgId <= partnerLastRead) {
      status = 'read';
    } else if (isGroup && Object.keys(memberLastReadMap).length > 0) {
      const otherMemberReadIds = Object.entries(memberLastReadMap)
        .filter(([memberId]) => memberId !== currentUserId)
        .map(([, lastRead]) => lastRead);
      if (
        otherMemberReadIds.length > 0 &&
        otherMemberReadIds.every((lastRead) => lastRead && msgId <= lastRead)
      ) {
        status = 'read';
      }
    }
  }

  return {
    id: msgId,
    conversationId: m.conversationId,
    clientMessageId: m.clientMessageId,
    senderId: m.senderId,
    receiverId: m.recipientId,
    groupId: m.groupId,
    text: m.text || m.content || '',
    attachments: m.attachments || [],
    timestamp: formattedTime,
    status,
    isAnnouncement: m.isAnnouncement,
    heading: m.heading,
    replyTo: m.replyTo,
    isDoubt: m.isDoubt,
    doubtStatus: m.doubtStatus,
    doubtTopic: m.doubtTopic,
    resolvedBy: m.resolvedBy,
    resolvedByName: m.resolvedByName,
    resolvedAt: m.resolvedAt,
  };
}

/**
 * Compares two ChatMessages chronologically:
 * 1. Optimistic messages (status === 'sending' or id starts with 'client-') are kept at the bottom.
 * 2. Confirmed messages (both sent and received) have ULIDs which are lexicographically sorted.
 */
export function compareMessageOrder(a: ChatMessage, b: ChatMessage): number {
  const isAOptimistic = a.status === 'sending' || a.id.startsWith('client-');
  const isBOptimistic = b.status === 'sending' || b.id.startsWith('client-');

  // Both are pending sending -> preserve bottom order by client timestamp
  if (isAOptimistic && isBOptimistic) {
    const timeA = parseInt(a.id.split('-')[1] || '0', 10);
    const timeB = parseInt(b.id.split('-')[1] || '0', 10);
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  }

  // Pending sending always stays at the bottom
  if (isAOptimistic) return 1;
  if (isBOptimistic) return -1;

  // Both have server ULIDs -> pure ULID lexicographical comparison
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Merges a batch of messages into an existing list:
 * - Deduplicates by message id and clientMessageId
 * - Updates existing message state (e.g. status transition from sending to sent)
 * - Guarantees strict chronological order via compareMessageOrder
 */
export function mergeAndSortMessages(
  existingMessages: ChatMessage[],
  incomingMessages: ChatMessage[],
): ChatMessage[] {
  if (incomingMessages.length === 0) return existingMessages;
  if (existingMessages.length === 0) return [...incomingMessages].sort(compareMessageOrder);

  // Map keyed by primary identity: server id and clientMessageId
  const result: ChatMessage[] = [...existingMessages];

  for (const incoming of incomingMessages) {
    const matchIndex = result.findIndex(
      (m) =>
        m.id === incoming.id ||
        (incoming.clientMessageId && m.clientMessageId === incoming.clientMessageId),
    );

    if (matchIndex !== -1) {
      // Update existing item with newer data
      result[matchIndex] = {
        ...result[matchIndex],
        ...incoming,
      };
    } else {
      result.push(incoming);
    }
  }

  return result.sort(compareMessageOrder);
}
