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

export interface DirectMessagePayload {
  recipientId: string;
  message: string;
  clientMessageId?: string;
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
}

export interface GroupMessagePayload {
  groupId: string;
  message: string;
  clientMessageId?: string;
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
