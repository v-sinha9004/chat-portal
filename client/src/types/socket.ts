export interface UserPresence {
  userId: string;
  isOnline: boolean;
  lastSeen: string | null;
}

export interface GroupPresence {
  groupId: string;
  totalMembers: number;
  onlineCount: number;
  onlineMemberIds: string[];
}

export interface UserPresenceChangedEvent {
  userId: string;
  isOnline: boolean;
  lastSeen: string | null;
}

export interface GroupPresenceChangedEvent {
  groupId: string;
  userId: string;
  isOnline: boolean;
}

export interface UserTypingEvent {
  userId: string;
  isTyping: boolean;
  recipientId?: string;
  groupId?: string;
}

export interface MarkReadPayload {
  conversationId: string;
  lastReadMessageId?: string;
}

export interface ConversationReadAckEvent {
  conversationId: string;
  lastReadMessageId: string;
}

export interface AckDeliveryPayload {
  conversationId: string;
  messageId: string;
  senderId?: string;
}

export interface MessageDeliveredEvent {
  conversationId: string;
  messageId: string;
  recipientId: string;
  deliveredAt: string;
}

export interface MessagesReadEvent {
  conversationId: string;
  readerId: string;
  lastReadMessageId: string;
  readAt: string;
}

export interface GroupMessagesReadEvent {
  conversationId: string;
  groupId: string;
  readerId: string;
  lastReadMessageId: string;
  readAt: string;
}

export interface MessageDeletedEvent {
  conversationId: string;
  messageId: string;
  deletedBy: string;
}

