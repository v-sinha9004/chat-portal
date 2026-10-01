import { ChatMessageResponse } from '../interfaces/message-response.interface';

/**
 * Clamps limit between 1 and 100 with default 50.
 */
export function sanitizeLimit(limit?: string | number): number {
  const parsed = typeof limit === 'number' ? limit : parseInt(String(limit || '50'), 10);
  if (isNaN(parsed) || parsed < 1) {
    return 50;
  }
  return Math.min(parsed, 100);
}

/**
 * Normalizes MongoDB document to consistent DTO response.
 */
export function formatMessageResponse(doc: any): ChatMessageResponse {
  const timestampIso =
    doc.timestamp instanceof Date
      ? doc.timestamp.toISOString()
      : new Date(doc.timestamp).toISOString();

  const resolvedAtIso = doc.resolvedAt
    ? doc.resolvedAt instanceof Date
      ? doc.resolvedAt.toISOString()
      : new Date(doc.resolvedAt).toISOString()
    : undefined;

  return {
    id: doc.messageId,
    messageId: doc.messageId,
    conversationId: doc.conversationId,
    clientMessageId: doc.clientMessageId,
    type: doc.type,
    senderId: doc.senderId,
    recipientId: doc.recipientId,
    groupId: doc.groupId,
    text: doc.content,
    content: doc.content,
    attachments: doc.attachments || [],
    status: doc.status || 'sent',
    timestamp: timestampIso,
    isAnnouncement: !!doc.isAnnouncement,
    heading: doc.heading,
    replyTo: doc.replyTo
      ? {
          messageId: doc.replyTo.messageId,
          senderId: doc.replyTo.senderId,
          text: doc.replyTo.text,
        }
      : undefined,
    isDoubt: !!doc.isDoubt,
    doubtStatus: doc.doubtStatus,
    doubtTopic: doc.doubtTopic,
    resolvedBy: doc.resolvedBy,
    resolvedByName: doc.resolvedByName,
    resolvedAt: resolvedAtIso,
  };
}
