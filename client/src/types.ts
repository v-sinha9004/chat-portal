export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'MENTEE' | 'MENTOR' | string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsersResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  senderName?: string;
  text: string;
  timestamp: string;
  clientMessageId?: string;
  status?: 'sending' | 'sent' | 'failed';
}

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


export type UserRole = 'ADMIN' | 'MENTOR' | 'MENTEE';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole | string;
  name?: string;
  username?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    role: UserRole | string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  username: string;
  name: string;
  role?: UserRole;
}

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

export interface UnreadCountsResponse {
  status: string;
  unreadCounts: Record<string, number>;
}

export interface MarkReadPayload {
  conversationId: string;
  lastReadMessageId?: string;
}

export interface ConversationReadAckEvent {
  conversationId: string;
  lastReadMessageId: string;
}

export function getDirectConversationId(userId1: string, userId2: string): string {
  return `direct:${[userId1, userId2].sort().join(':')}`;
}

export function getGroupConversationId(groupId: string): string {
  return `group:${groupId}`;
}
