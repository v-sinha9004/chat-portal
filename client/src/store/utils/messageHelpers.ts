import type { ChatMessage } from '../../types';

export function mapHistoryMessageToChatMessage(
  m: any,
  currentUserId: string | null,
  isGroup: boolean,
  partnerLastRead?: string | null,
  memberLastReadMap: Record<string, string> = {},
): ChatMessage {
  const msgId = m.id || m.messageId;
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
