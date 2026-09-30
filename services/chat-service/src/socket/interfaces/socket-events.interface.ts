import { Socket } from 'socket.io';

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: string;
  [key: string]: any;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    user?: JwtUserPayload;
    [key: string]: any;
  };
}

export interface ReplyToPayload {
  messageId: string;
  senderId: string;
  text: string;
}

export interface DirectMessagePayload {
  recipientId: string;
  message: string;
  clientMessageId?: string;
  isAnnouncement?: boolean;
  heading?: string;
  replyTo?: ReplyToPayload;
  [key: string]: any;
}

export interface NewMessageEvent<T = any> {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  data: T;
  timestamp: string;
  clientMessageId?: string;
  isAnnouncement?: boolean;
  heading?: string;
  replyTo?: ReplyToPayload;
}

export interface GroupMessagePayload {
  groupId: string;
  message: string;
  clientMessageId?: string;
  isAnnouncement?: boolean;
  heading?: string;
  replyTo?: ReplyToPayload;
  [key: string]: any;
}

export interface GroupMessageEvent<T = any> {
  id: string;
  conversationId: string;
  groupId: string;
  senderId: string;
  data: T;
  timestamp: string;
  clientMessageId?: string;
  isAnnouncement?: boolean;
  heading?: string;
  replyTo?: ReplyToPayload;
}

export function getDirectConversationId(userId1: string, userId2: string): string {
  return `direct:${[userId1, userId2].sort().join(':')}`;
}

export function getGroupConversationId(groupId: string): string {
  return `group:${groupId}`;
}

export function getUserPresenceRoom(userId: string): string {
  return `presence:user:${userId}`;
}

export function getGroupPresenceRoom(groupId: string): string {
  return `presence:group:${groupId}`;
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

export interface SubscribeUserPresencePayload {
  targetUserId: string;
}

export interface SubscribeGroupPresencePayload {
  groupId: string;
}

export interface TypingStartPayload {
  recipientId?: string;
  groupId?: string;
}

export interface TypingStopPayload {
  recipientId?: string;
  groupId?: string;
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

