import type { StateCreator } from 'zustand';
import type {
  User,
  Group,
  ActiveConversation,
  ChatMessage,
  UserPresence,
  GroupPresence,
  PinnedMessage,
  AttachmentInfo,
} from '../../types';

// ==========================================
// 1. PIN SLICE
// ==========================================
export interface PinSlice {
  pinnedMessages: PinnedMessage[];
  activePinIndex: number;
  isLoadingPins: boolean;

  fetchPinnedMessages: (conversationId?: string) => Promise<void>;
  pinMessage: (messageId: string) => Promise<boolean>;
  unpinMessage: (messageId: string) => Promise<boolean>;
  setActivePinIndex: (index: number) => void;
  nextPin: () => void;
  prevPin: () => void;
}

// ==========================================
// 2. PRESENCE SLICE
// ==========================================
export interface PresenceSlice {
  activePresence: UserPresence | null;
  activeGroupPresence: GroupPresence | null;
  isLoadingPresence: boolean;
  typingUsersByConversation: Record<string, string[]>;

  sendTypingStart: () => void;
  sendTypingStop: () => void;
}

// ==========================================
// 3. UNREAD SLICE
// ==========================================
export interface UnreadSlice {
  unreadCountsByConversation: Record<string, number>;
  unreadUserIds: Set<string>;
  unreadGroupIds: Set<string>;
  partnerLastReadMessageId: string | null;
  groupMemberLastReadMap: Record<string, string>;

  getConversationUnreadCount: (conversationId: string) => number;
  markConversationRead: (conversationId: string, lastReadMessageId?: string) => void;
}

// ==========================================
// 4. CONVERSATION SLICE
// ==========================================
export interface ConversationSlice {
  users: User[];
  groups: Group[];
  isLoadingConversations: boolean;
  conversationsError: string | null;
  activeConversation: ActiveConversation | null;

  fetchConversations: () => Promise<void>;
  selectConversation: (conversation: ActiveConversation | null) => void;
  addGroup: (newGroup: Group) => void;
}

// ==========================================
// 5. MESSAGE SLICE
// ==========================================
export interface MessageSlice {
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  messageError: string | null;
  hasMoreMessages: boolean;
  oldestMessageCursor: string | null;
  isLoadingOlderMessages: boolean;
  replyingTo: ChatMessage | null;

  hasNewerMessages: boolean;
  newestMessageCursor: string | null;
  isLoadingNewerMessages: boolean;
  isLoadingContext: boolean;
  unseenLiveCountWhileInHistory: number;

  setReplyingTo: (message: ChatMessage | null) => void;
  fetchMessages: (targetConvo?: ActiveConversation) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  loadNewerMessages: () => Promise<void>;
  jumpToMessage: (messageId: string) => Promise<boolean>;
  jumpToLatest: () => Promise<void>;
  sendMessage: (
    text: string,
    options?: {
      isAnnouncement?: boolean;
      heading?: string;
      isDoubt?: boolean;
      doubtTopic?: string;
      attachments?: AttachmentInfo[];
    },
  ) => Promise<void>;
  updateDoubtStatus: (
    messageId: string,
    status: 'OPEN' | 'RESOLVED',
  ) => Promise<void>;
}

// ==========================================
// 6. SOCKET SLICE
// ==========================================
export interface SocketSlice {
  isSocketConnected: boolean;

  initSocket: () => void;
  disconnectSocket: (isLogout?: boolean) => void;
}

// ==========================================
// COMBINED ROOT STORE STATE
// ==========================================
export interface GlobalChatActions {
  reset: () => void;
}

export type ChatState = PinSlice &
  PresenceSlice &
  UnreadSlice &
  ConversationSlice &
  MessageSlice &
  SocketSlice &
  GlobalChatActions;

// Slice creator helper type for Zustand slice pattern
export type ChatSlice<T> = StateCreator<ChatState, [], [], T>;
