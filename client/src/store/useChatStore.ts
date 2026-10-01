import { create } from 'zustand';
import type {
  User,
  Group,
  ActiveConversation,
  ChatMessage,
  UserPresence,
  GroupPresence,
  UserPresenceChangedEvent,
  GroupPresenceChangedEvent,
  UserTypingEvent,
  ReplyToInfo,
  PinnedMessage,
  AttachmentInfo,
} from '../types';
import { getDirectConversationId, getGroupConversationId } from '../types';
import {
  fetchDirectMessages,
  fetchGroupMessages,
  fetchMessageContext,
  updateDoubtStatusRest,
} from '../services/chatService';
import {
  socketService,
  type IncomingDirectMessageEvent,
  type IncomingGroupMessageEvent,
} from '../services/socketService';
import { useAuthStore } from './useAuthStore';

interface ChatState {
  // Conversations & Contacts
  users: User[];
  groups: Group[];
  isLoadingConversations: boolean;
  conversationsError: string | null;

  // Selected Conversation
  activeConversation: ActiveConversation | null;

  // Active Conversation Presence (On-Demand)
  activePresence: UserPresence | null;
  activeGroupPresence: GroupPresence | null;
  isLoadingPresence: boolean;

  // Real-time Typing Users (key: 'user:<userId>' or 'group:<groupId>')
  typingUsersByConversation: Record<string, string[]>;

  // Unread Maps and Sets
  unreadCountsByConversation: Record<string, number>;
  unreadUserIds: Set<string>;
  unreadGroupIds: Set<string>;
  getConversationUnreadCount: (conversationId: string) => number;
  markConversationRead: (conversationId: string, lastReadMessageId?: string) => void;

  // Read Watermarks
  partnerLastReadMessageId: string | null;
  groupMemberLastReadMap: Record<string, string>;

  // Socket State
  isSocketConnected: boolean;

  // Active Chat Messages
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  messageError: string | null;
  hasMoreMessages: boolean;
  oldestMessageCursor: string | null;
  isLoadingOlderMessages: boolean;
  replyingTo: ChatMessage | null;

  // Bidirectional Window State (Modular: replies, pins, search jumps)
  hasNewerMessages: boolean;
  newestMessageCursor: string | null;
  isLoadingNewerMessages: boolean;
  isLoadingContext: boolean;
  unseenLiveCountWhileInHistory: number;

  // Pinned Messages Carousel
  pinnedMessages: PinnedMessage[];
  activePinIndex: number;
  isLoadingPins: boolean;

  // Actions
  setReplyingTo: (message: ChatMessage | null) => void;
  fetchConversations: () => Promise<void>;
  selectConversation: (conversation: ActiveConversation | null) => void;
  fetchMessages: (targetConvo?: ActiveConversation) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  loadNewerMessages: () => Promise<void>;
  jumpToMessage: (messageId: string) => Promise<boolean>;
  jumpToLatest: () => Promise<void>;
  fetchPinnedMessages: (conversationId?: string) => Promise<void>;
  pinMessage: (messageId: string) => Promise<boolean>;
  unpinMessage: (messageId: string) => Promise<boolean>;
  setActivePinIndex: (index: number) => void;
  nextPin: () => void;
  prevPin: () => void;
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
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  addGroup: (newGroup: Group) => void;
  initSocket: () => void;
  disconnectSocket: (isLogout?: boolean) => void;
  reset: () => void;
}

import { createPinSlice, cancelPinsRequest } from './slices/pinSlice';
import { createPresenceSlice, typingSafetyTimers, clearTypingSafetyTimers } from './slices/presenceSlice';
import { createUnreadSlice, debouncedMarkRead, clearMarkReadTimer } from './slices/unreadSlice';
import { createConversationSlice, cancelConvoRequest } from './slices/conversationSlice';
export type { ChatState } from './slices/types';

let messageAbortController: AbortController | null = null;
let unsubscribeConn: (() => void) | null = null;
let unsubscribeDirect: (() => void) | null = null;
let unsubscribeGroup: (() => void) | null = null;
let unsubscribeUserPresence: (() => void) | null = null;
let unsubscribeGroupPresence: (() => void) | null = null;
let unsubscribeTyping: (() => void) | null = null;
let unsubscribeReadAck: (() => void) | null = null;
let unsubscribeMessageDelivered: (() => void) | null = null;
let unsubscribeMessagesRead: (() => void) | null = null;
let unsubscribeGroupMessagesRead: (() => void) | null = null;
let unsubscribeDoubtStatus: (() => void) | null = null;
let unsubscribeMessagePinned: (() => void) | null = null;
let unsubscribeMessageUnpinned: (() => void) | null = null;

function mapHistoryMessageToChatMessage(
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

export const useChatStore = create<ChatState>((set, get, api) => ({
  ...createPinSlice(set, get, api),
  ...createPresenceSlice(set, get, api),
  ...createUnreadSlice(set, get, api),
  ...createConversationSlice(set, get, api),

  isSocketConnected: false,

  messages: [],
  isLoadingMessages: false,
  messageError: null,
  hasMoreMessages: false,
  oldestMessageCursor: null,
  isLoadingOlderMessages: false,
  replyingTo: null,

  hasNewerMessages: false,
  newestMessageCursor: null,
  isLoadingNewerMessages: false,
  isLoadingContext: false,
  unseenLiveCountWhileInHistory: 0,

  setReplyingTo: (message) => set({ replyingTo: message }),

  fetchMessages: async (targetConvo) => {
    const convo = targetConvo || get().activeConversation;
    const token = useAuthStore.getState().accessToken;
    const currentUserId = useAuthStore.getState().user?.id || null;

    if (!convo || !token) {
      set({ isLoadingMessages: false, messages: [], messageError: null });
      return;
    }

    if (messageAbortController) {
      messageAbortController.abort();
    }
    messageAbortController = new AbortController();
    const signal = messageAbortController.signal;

    set({ isLoadingMessages: true, messageError: null });

    const isGroup = convo.type === 'group';
    const targetId = convo.id;
    const expectedConvoId = isGroup
      ? `group:${targetId}`
      : currentUserId
      ? `direct:${[currentUserId, targetId].sort().join(':')}`
      : null;

    try {
      const response = isGroup
        ? await fetchGroupMessages(token, targetId, { limit: 50, signal })
        : await fetchDirectMessages(token, targetId, { limit: 50, signal });

      if (signal.aborted) return;

      const partnerLastRead = response.partnerLastReadMessageId || null;
      const memberLastReadMap = response.memberLastReadMap || {};

      const pastMessages: ChatMessage[] = (response.messages || []).map((m) =>
        mapHistoryMessageToChatMessage(
          m,
          currentUserId,
          isGroup,
          partnerLastRead,
          memberLastReadMap,
        ),
      );

      set((state) => {
        const pendingSending = state.messages.filter(
          (m) =>
            (!expectedConvoId || m.conversationId === expectedConvoId) &&
            m.status === 'sending',
        );
        const merged = [...pastMessages];
        for (const msg of pendingSending) {
          if (
            !merged.some(
              (m) =>
                (msg.clientMessageId && m.clientMessageId === msg.clientMessageId) ||
                m.id === msg.id,
            )
          ) {
            merged.push(msg);
          }
        }
        return {
          messages: merged,
          partnerLastReadMessageId: partnerLastRead,
          groupMemberLastReadMap: memberLastReadMap,
          hasMoreMessages: Boolean(response.hasMore),
          oldestMessageCursor: response.oldestCursor || null,
          hasNewerMessages: false,
          newestMessageCursor: null,
          isLoadingMessages: false,
          isLoadingOlderMessages: false,
          isLoadingNewerMessages: false,
          isLoadingContext: false,
          unseenLiveCountWhileInHistory: 0,
          messageError: null,
        };
      });

      if (pastMessages.length > 0 && expectedConvoId) {
        const latestMsg = pastMessages[pastMessages.length - 1];
        if (latestMsg?.id) {
          debouncedMarkRead(expectedConvoId, latestMsg.id);
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to fetch conversation history';
      console.error('Failed to load past messages:', err);
      set({
        isLoadingMessages: false,
        isLoadingOlderMessages: false,
        isLoadingNewerMessages: false,
        isLoadingContext: false,
        messageError: errorMsg,
      });
    }
  },

  loadOlderMessages: async () => {
    const {
      activeConversation: convo,
      hasMoreMessages,
      oldestMessageCursor,
      isLoadingOlderMessages,
      isLoadingMessages,
    } = get();

    const token = useAuthStore.getState().accessToken;
    const currentUserId = useAuthStore.getState().user?.id || null;

    if (
      !convo ||
      !token ||
      !hasMoreMessages ||
      !oldestMessageCursor ||
      isLoadingOlderMessages ||
      isLoadingMessages
    ) {
      return;
    }

    set({ isLoadingOlderMessages: true });

    const isGroup = convo.type === 'group';
    const targetId = convo.id;

    try {
      const response = isGroup
        ? await fetchGroupMessages(token, targetId, {
            limit: 50,
            before: oldestMessageCursor,
          })
        : await fetchDirectMessages(token, targetId, {
            limit: 50,
            before: oldestMessageCursor,
          });

      if (get().activeConversation?.id !== targetId) {
        set({ isLoadingOlderMessages: false });
        return;
      }

      const partnerLastRead = response.partnerLastReadMessageId || get().partnerLastReadMessageId;
      const memberLastReadMap = {
        ...get().groupMemberLastReadMap,
        ...(response.memberLastReadMap || {}),
      };

      const olderMessages: ChatMessage[] = (response.messages || []).map((m) =>
        mapHistoryMessageToChatMessage(
          m,
          currentUserId,
          isGroup,
          partnerLastRead,
          memberLastReadMap,
        ),
      );

      set((state) => {
        const existingIds = new Set(state.messages.map((m) => m.id));
        const filteredOlder = olderMessages.filter(
          (m) =>
            !existingIds.has(m.id) &&
            (!m.clientMessageId ||
              !state.messages.some((cur) => cur.clientMessageId === m.clientMessageId)),
        );

        return {
          messages: [...filteredOlder, ...state.messages],
          hasMoreMessages: Boolean(response.hasMore),
          oldestMessageCursor: response.oldestCursor || null,
          partnerLastReadMessageId: partnerLastRead,
          groupMemberLastReadMap: memberLastReadMap,
          isLoadingOlderMessages: false,
        };
      });
    } catch (err) {
      console.error('Failed to load older messages:', err);
      set({ isLoadingOlderMessages: false });
    }
  },

  loadNewerMessages: async () => {
    const {
      activeConversation: convo,
      hasNewerMessages,
      newestMessageCursor,
      isLoadingNewerMessages,
      isLoadingMessages,
    } = get();

    const token = useAuthStore.getState().accessToken;
    const currentUserId = useAuthStore.getState().user?.id || null;

    if (
      !convo ||
      !token ||
      !hasNewerMessages ||
      !newestMessageCursor ||
      isLoadingNewerMessages ||
      isLoadingMessages
    ) {
      return;
    }

    set({ isLoadingNewerMessages: true });

    const isGroup = convo.type === 'group';
    const targetId = convo.id;

    try {
      const response = isGroup
        ? await fetchGroupMessages(token, targetId, {
            limit: 50,
            after: newestMessageCursor,
          })
        : await fetchDirectMessages(token, targetId, {
            limit: 50,
            after: newestMessageCursor,
          });

      if (get().activeConversation?.id !== targetId) {
        set({ isLoadingNewerMessages: false });
        return;
      }

      const partnerLastRead = response.partnerLastReadMessageId || get().partnerLastReadMessageId;
      const memberLastReadMap = {
        ...get().groupMemberLastReadMap,
        ...(response.memberLastReadMap || {}),
      };

      const newerMessages: ChatMessage[] = (response.messages || []).map((m) =>
        mapHistoryMessageToChatMessage(
          m,
          currentUserId,
          isGroup,
          partnerLastRead,
          memberLastReadMap,
        ),
      );

      set((state) => {
        const existingIds = new Set(state.messages.map((m) => m.id));
        const filteredNewer = newerMessages.filter(
          (m) =>
            !existingIds.has(m.id) &&
            (!m.clientMessageId ||
              !state.messages.some((cur) => cur.clientMessageId === m.clientMessageId)),
        );

        const stillHasNewer = Boolean(response.hasNewer);

        return {
          messages: [...state.messages, ...filteredNewer],
          hasNewerMessages: stillHasNewer,
          newestMessageCursor: response.newestCursor || null,
          partnerLastReadMessageId: partnerLastRead,
          groupMemberLastReadMap: memberLastReadMap,
          isLoadingNewerMessages: false,
          unseenLiveCountWhileInHistory: stillHasNewer ? state.unseenLiveCountWhileInHistory : 0,
        };
      });
    } catch (err) {
      console.error('Failed to load newer messages:', err);
      set({ isLoadingNewerMessages: false });
    }
  },

  jumpToMessage: async (messageId: string): Promise<boolean> => {
    const cleanId = messageId?.trim();
    if (!cleanId) return false;

    // Fast path: already present in active window
    if (get().messages.some((m) => m.id === cleanId)) {
      return true;
    }

    const convo = get().activeConversation;
    const token = useAuthStore.getState().accessToken;
    const currentUserId = useAuthStore.getState().user?.id || null;
    if (!convo || !token) return false;

    set({ isLoadingContext: true, messageError: null });

    try {
      const response = await fetchMessageContext(token, cleanId, 25);
      if (get().activeConversation?.id !== convo.id) {
        set({ isLoadingContext: false });
        return false;
      }

      const partnerLastRead = response.partnerLastReadMessageId || get().partnerLastReadMessageId;
      const memberLastReadMap = {
        ...get().groupMemberLastReadMap,
        ...(response.memberLastReadMap || {}),
      };
      const isGroup = convo.type === 'group';

      const mappedMessages = (response.messages || []).map((m) =>
        mapHistoryMessageToChatMessage(
          m,
          currentUserId,
          isGroup,
          partnerLastRead,
          memberLastReadMap,
        ),
      );

      set({
        messages: mappedMessages,
        hasMoreMessages: Boolean(response.hasOlder),
        hasNewerMessages: Boolean(response.hasNewer),
        oldestMessageCursor: response.oldestCursor || null,
        newestMessageCursor: response.newestCursor || null,
        partnerLastReadMessageId: partnerLastRead,
        groupMemberLastReadMap: memberLastReadMap,
        unseenLiveCountWhileInHistory: 0,
        isLoadingContext: false,
      });

      return true;
    } catch (err: unknown) {
      console.error('Failed to fetch message context:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to fetch message context';
      set({ isLoadingContext: false, messageError: errorMsg });
      return false;
    }
  },

  jumpToLatest: async () => {
    set({
      hasNewerMessages: false,
      newestMessageCursor: null,
      unseenLiveCountWhileInHistory: 0,
    });
    await get().fetchMessages();
  },


  sendMessage: async (
    text: string,
    options?: {
      isAnnouncement?: boolean;
      heading?: string;
      isDoubt?: boolean;
      doubtTopic?: string;
      attachments?: AttachmentInfo[];
    },
  ) => {
    if (get().hasNewerMessages) {
      await get().jumpToLatest();
    }
    const activeConversation = get().activeConversation;
    const currentUserId = useAuthStore.getState().user?.id;
    const hasAttachments = !!(options?.attachments && options.attachments.length > 0);
    const trimmedText = text.trim();
    if ((!trimmedText && !hasAttachments) || !activeConversation || !currentUserId) return;

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isGroup = activeConversation.type === 'group';
    const expectedConvoId = isGroup
      ? `group:${activeConversation.id}`
      : `direct:${[currentUserId, activeConversation.id].sort().join(':')}`;

    const replyingTo = get().replyingTo;
    const replyToPayload: ReplyToInfo | undefined = replyingTo
      ? {
          messageId: replyingTo.id,
          senderId: replyingTo.senderId,
          text: replyingTo.text.slice(0, 120),
        }
      : undefined;

    const optimisticMessage: ChatMessage = {
      id: clientMessageId,
      conversationId: expectedConvoId,
      clientMessageId,
      senderId: currentUserId,
      receiverId: !isGroup ? activeConversation.id : undefined,
      groupId: isGroup ? activeConversation.id : undefined,
      text: trimmedText,
      attachments: options?.attachments,
      timestamp: formattedTime,
      status: 'sending',
      isAnnouncement: options?.isAnnouncement,
      heading: options?.heading,
      replyTo: replyToPayload,
      isDoubt: options?.isDoubt,
      doubtStatus: options?.isDoubt ? 'OPEN' : undefined,
      doubtTopic: options?.doubtTopic,
    };

    set((state) => ({ messages: [...state.messages, optimisticMessage], replyingTo: null }));

    try {
      if (isGroup) {
        const ack = await socketService.sendGroupMessage(
          activeConversation.id,
          trimmedText,
          clientMessageId,
          { ...options, replyTo: replyToPayload },
        );
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.clientMessageId === clientMessageId
              ? {
                  ...msg,
                  id: ack.messageId || msg.id,
                  status: 'sent',
                }
              : msg,
          ),
        }));
      } else {
        const ack = await socketService.sendMessage(
          activeConversation.id,
          trimmedText,
          clientMessageId,
          {
            replyTo: replyToPayload,
            isDoubt: options?.isDoubt,
            doubtTopic: options?.doubtTopic,
            attachments: options?.attachments,
          },
        );
        const newStatus = ack?.delivered ? 'delivered' : 'sent';
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.clientMessageId === clientMessageId
              ? {
                  ...msg,
                  id: ack.messageId || msg.id,
                  status: newStatus,
                }
              : msg,
          ),
        }));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.clientMessageId === clientMessageId ? { ...msg, status: 'failed' } : msg,
        ),
      }));
    }
  },

  updateDoubtStatus: async (messageId: string, status: 'OPEN' | 'RESOLVED') => {
    const active = get().activeConversation;
    if (!active) return;
    const currentUserId = useAuthStore.getState().user?.id;
    const currentUserName = useAuthStore.getState().user?.name || 'User';
    const token = useAuthStore.getState().accessToken;
    const isGroup = active.type === 'group';
    const convoId = isGroup
      ? `group:${active.id}`
      : `direct:${[currentUserId, active.id].sort().join(':')}`;

    // Optimistically update message in active view
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              doubtStatus: status,
              resolvedBy: status === 'RESOLVED' ? currentUserId : undefined,
              resolvedByName: status === 'RESOLVED' ? currentUserName : undefined,
              resolvedAt: status === 'RESOLVED' ? new Date().toISOString() : undefined,
            }
          : m,
      ),
    }));

    try {
      await socketService.updateDoubtStatus({
        conversationId: convoId,
        messageId,
        status,
      });
    } catch (socketErr) {
      console.warn('Socket update_doubt_status failed, trying REST fallback:', socketErr);
      if (token) {
        try {
          await updateDoubtStatusRest(token, messageId, convoId, status);
        } catch (restErr) {
          console.error('REST updateDoubtStatus fallback failed:', restErr);
        }
      }
    }
  },


  initSocket: () => {
    get().disconnectSocket();

    const token = useAuthStore.getState().accessToken;
    const currentUserId = useAuthStore.getState().user?.id;

    if (!token || !currentUserId) return;

    socketService.connect(token, currentUserId);

    unsubscribeConn = socketService.onConnectionChange((connected) => {
      set({ isSocketConnected: connected });
      if (connected) {
        const active = get().activeConversation;
        if (active) {
          if (active.type === 'direct') {
            socketService
              .subscribeUserPresence(active.id)
              .then((presence) => {
                if (get().activeConversation?.id === active.id) {
                  set({ activePresence: presence, isLoadingPresence: false });
                }
              })
              .catch(() => {});
          } else {
            socketService
              .subscribeGroupPresence(active.id)
              .then((presence) => {
                if (get().activeConversation?.id === active.id) {
                  set({ activeGroupPresence: presence, isLoadingPresence: false });
                }
              })
              .catch(() => {});
          }
        }
      }
    });

    unsubscribeDirect = socketService.onDirectMessage((payload: IncomingDirectMessageEvent) => {
      const currentConvo = get().activeConversation;
      const myId = useAuthStore.getState().user?.id;
      const partnerId = payload.senderId;

      const isCurrentChat =
        currentConvo &&
        currentConvo.type === 'direct' &&
        (currentConvo.id === partnerId ||
          (myId && currentConvo.id === payload.recipientId && partnerId === myId));

      const expectedConvoId = myId
        ? getDirectConversationId(myId, partnerId)
        : `direct:${partnerId}`;

      // Acknowledge delivery to sender so sender receives double tick ✓✓
      if (payload.id && partnerId !== myId) {
        socketService.ackDelivery(
          payload.conversationId || expectedConvoId,
          payload.id,
          partnerId,
        );
      }

      const isVisibleAndActive =
        isCurrentChat &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible';

      if (isCurrentChat) {
        const formattedTime = new Date(payload.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const incomingMsg: ChatMessage = {
          id: payload.id,
          conversationId: payload.conversationId || expectedConvoId,
          clientMessageId: payload.clientMessageId,
          senderId: payload.senderId,
          receiverId: payload.recipientId,
          text: payload.data?.message || '',
          attachments: payload.attachments || [],
          timestamp: formattedTime,
          status: 'sent',
          replyTo: payload.replyTo,
          isDoubt: payload.isDoubt,
          doubtStatus: payload.doubtStatus,
          doubtTopic: payload.doubtTopic,
          resolvedBy: payload.resolvedBy,
          resolvedByName: payload.resolvedByName,
          resolvedAt: payload.resolvedAt,
        };

        const directTimerKey = `user:${partnerId}:${partnerId}`;
        if (typingSafetyTimers.has(directTimerKey)) {
          clearTimeout(typingSafetyTimers.get(directTimerKey)!);
          typingSafetyTimers.delete(directTimerKey);
        }

        if (isVisibleAndActive) {
          debouncedMarkRead(expectedConvoId, payload.id);
        }

        set((state) => {
          const currentTyping = state.typingUsersByConversation[`user:${partnerId}`] || [];
          const updatedTyping = currentTyping.filter((id) => id !== partnerId);

          let nextCounts = state.unreadCountsByConversation;
          let nextUnreadUsers = state.unreadUserIds;
          if (!isVisibleAndActive) {
            nextCounts = {
              ...state.unreadCountsByConversation,
              [expectedConvoId]: (state.unreadCountsByConversation[expectedConvoId] || 0) + 1,
            };
            nextUnreadUsers = new Set(state.unreadUserIds);
            nextUnreadUsers.add(partnerId);
          }

          const existingIndex = state.messages.findIndex(
            (m) =>
              m.id === incomingMsg.id ||
              (incomingMsg.clientMessageId &&
                m.clientMessageId === incomingMsg.clientMessageId),
          );

          if (existingIndex !== -1) {
            const nextMessages = [...state.messages];
            nextMessages[existingIndex] = {
              ...nextMessages[existingIndex],
              ...incomingMsg,
            };
            return {
              messages: nextMessages,
              unreadCountsByConversation: nextCounts,
              unreadUserIds: nextUnreadUsers,
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`user:${partnerId}`]: updatedTyping,
              },
            };
          }

          if (state.hasNewerMessages) {
            return {
              unseenLiveCountWhileInHistory: state.unseenLiveCountWhileInHistory + 1,
              unreadCountsByConversation: nextCounts,
              unreadUserIds: nextUnreadUsers,
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`user:${partnerId}`]: updatedTyping,
              },
            };
          }

          return {
            messages: [...state.messages, incomingMsg],
            unreadCountsByConversation: nextCounts,
            unreadUserIds: nextUnreadUsers,
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [`user:${partnerId}`]: updatedTyping,
            },
          };
        });
      } else {
        const directTimerKey = `user:${partnerId}:${partnerId}`;
        if (typingSafetyTimers.has(directTimerKey)) {
          clearTimeout(typingSafetyTimers.get(directTimerKey)!);
          typingSafetyTimers.delete(directTimerKey);
        }

        set((state) => {
          const next = new Set(state.unreadUserIds);
          next.add(partnerId);
          const nextCounts = {
            ...state.unreadCountsByConversation,
            [expectedConvoId]: (state.unreadCountsByConversation[expectedConvoId] || 0) + 1,
          };
          const currentTyping = state.typingUsersByConversation[`user:${partnerId}`] || [];
          return {
            unreadCountsByConversation: nextCounts,
            unreadUserIds: next,
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [`user:${partnerId}`]: currentTyping.filter((id) => id !== partnerId),
            },
          };
        });
      }
    });

    unsubscribeGroup = socketService.onGroupMessage((payload: IncomingGroupMessageEvent) => {
      const currentConvo = get().activeConversation;
      const { groupId } = payload;
      const senderId = payload.senderId;
      const convoId = getGroupConversationId(groupId);

      const isCurrentGroup =
        currentConvo && currentConvo.type === 'group' && currentConvo.id === groupId;

      const isVisibleAndActive =
        isCurrentGroup &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible';

      const groupTimerKey = `group:${groupId}:${senderId}`;
      if (typingSafetyTimers.has(groupTimerKey)) {
        clearTimeout(typingSafetyTimers.get(groupTimerKey)!);
        typingSafetyTimers.delete(groupTimerKey);
      }

      if (isCurrentGroup) {
        const formattedTime = new Date(payload.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const incomingMsg: ChatMessage = {
          id: payload.id,
          conversationId: payload.conversationId || convoId,
          clientMessageId: payload.clientMessageId,
          senderId: payload.senderId,
          groupId: payload.groupId,
          text: payload.data?.message || '',
          attachments: payload.attachments || [],
          timestamp: formattedTime,
          status: 'sent',
          isAnnouncement: payload.isAnnouncement,
          heading: payload.heading,
          replyTo: payload.replyTo,
          isDoubt: payload.isDoubt,
          doubtStatus: payload.doubtStatus,
          doubtTopic: payload.doubtTopic,
          resolvedBy: payload.resolvedBy,
          resolvedByName: payload.resolvedByName,
          resolvedAt: payload.resolvedAt,
        };

        if (isVisibleAndActive) {
          debouncedMarkRead(convoId, payload.id);
        }

        set((state) => {
          const currentTyping = state.typingUsersByConversation[`group:${groupId}`] || [];
          const updatedTyping = currentTyping.filter((id) => id !== senderId);

          let nextCounts = state.unreadCountsByConversation;
          let nextUnreadGroups = state.unreadGroupIds;
          if (!isVisibleAndActive) {
            nextCounts = {
              ...state.unreadCountsByConversation,
              [convoId]: (state.unreadCountsByConversation[convoId] || 0) + 1,
            };
            nextUnreadGroups = new Set(state.unreadGroupIds);
            nextUnreadGroups.add(groupId);
          }

          const existingIndex = state.messages.findIndex(
            (m) =>
              m.id === incomingMsg.id ||
              (incomingMsg.clientMessageId &&
                m.clientMessageId === incomingMsg.clientMessageId),
          );

          if (existingIndex !== -1) {
            const nextMessages = [...state.messages];
            nextMessages[existingIndex] = {
              ...nextMessages[existingIndex],
              ...incomingMsg,
              status: 'sent',
            };
            return {
              messages: nextMessages,
              unreadCountsByConversation: nextCounts,
              unreadGroupIds: nextUnreadGroups,
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`group:${groupId}`]: updatedTyping,
              },
            };
          }

          if (state.hasNewerMessages) {
            return {
              unseenLiveCountWhileInHistory: state.unseenLiveCountWhileInHistory + 1,
              unreadCountsByConversation: nextCounts,
              unreadGroupIds: nextUnreadGroups,
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`group:${groupId}`]: updatedTyping,
              },
            };
          }

          return {
            messages: [...state.messages, incomingMsg],
            unreadCountsByConversation: nextCounts,
            unreadGroupIds: nextUnreadGroups,
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [`group:${groupId}`]: updatedTyping,
            },
          };
        });
      } else {
        set((state) => {
          const next = new Set(state.unreadGroupIds);
          next.add(groupId);
          const nextCounts = {
            ...state.unreadCountsByConversation,
            [convoId]: (state.unreadCountsByConversation[convoId] || 0) + 1,
          };
          const currentTyping = state.typingUsersByConversation[`group:${groupId}`] || [];
          return {
            unreadCountsByConversation: nextCounts,
            unreadGroupIds: next,
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [`group:${groupId}`]: currentTyping.filter((id) => id !== senderId),
            },
          };
        });
      }
    });

    unsubscribeUserPresence = socketService.onUserPresenceChanged((payload: UserPresenceChangedEvent) => {
      const currentConvo = get().activeConversation;
      if (currentConvo && currentConvo.type === 'direct' && currentConvo.id === payload.userId) {
        set({
          activePresence: {
            userId: payload.userId,
            isOnline: payload.isOnline,
            lastSeen: payload.lastSeen,
          },
          isLoadingPresence: false,
        });
      }
    });

    unsubscribeGroupPresence = socketService.onGroupPresenceChanged((payload: GroupPresenceChangedEvent) => {
      const currentConvo = get().activeConversation;
      if (currentConvo && currentConvo.type === 'group' && currentConvo.id === payload.groupId) {
        set((state) => {
          if (!state.activeGroupPresence) return state;
          const currentMembers = new Set(state.activeGroupPresence.onlineMemberIds);
          if (payload.isOnline) {
            currentMembers.add(payload.userId);
          } else {
            currentMembers.delete(payload.userId);
          }
          const onlineMemberIds = Array.from(currentMembers);
          return {
            activeGroupPresence: {
              ...state.activeGroupPresence,
              onlineCount: onlineMemberIds.length,
              onlineMemberIds,
            },
            isLoadingPresence: false,
          };
        });
      }
    });

    unsubscribeTyping = socketService.onUserTyping((event: UserTypingEvent) => {
      const myId = useAuthStore.getState().user?.id;
      if (event.userId === myId) return;

      const convKey = event.groupId
        ? `group:${event.groupId}`
        : `user:${event.userId}`;
      const timerKey = `${convKey}:${event.userId}`;

      if (event.isTyping) {
        if (typingSafetyTimers.has(timerKey)) {
          clearTimeout(typingSafetyTimers.get(timerKey)!);
        }

        const timer = setTimeout(() => {
          typingSafetyTimers.delete(timerKey);
          set((state) => {
            const current = state.typingUsersByConversation[convKey] || [];
            return {
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [convKey]: current.filter((id) => id !== event.userId),
              },
            };
          });
        }, 4000);
        typingSafetyTimers.set(timerKey, timer);

        set((state) => {
          const current = state.typingUsersByConversation[convKey] || [];
          if (current.includes(event.userId)) return state;
          return {
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [convKey]: [...current, event.userId],
            },
          };
        });
      } else {
        if (typingSafetyTimers.has(timerKey)) {
          clearTimeout(typingSafetyTimers.get(timerKey)!);
          typingSafetyTimers.delete(timerKey);
        }

        set((state) => {
          const current = state.typingUsersByConversation[convKey] || [];
          if (!current.includes(event.userId)) return state;
          return {
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [convKey]: current.filter((id) => id !== event.userId),
            },
          };
        });
      }
    });

    unsubscribeReadAck = socketService.onConversationReadAck((payload) => {
      const currentUserId = useAuthStore.getState().user?.id;
      set((state) => {
        const nextCounts = {
          ...state.unreadCountsByConversation,
          [payload.conversationId]: 0,
        };
        const nextUsers = new Set(state.unreadUserIds);
        const nextGroups = new Set(state.unreadGroupIds);

        if (payload.conversationId.startsWith('direct:') && currentUserId) {
          const parts = payload.conversationId.slice(7).split(':');
          const partner = parts.find((id) => id !== currentUserId);
          if (partner) nextUsers.delete(partner);
        } else if (payload.conversationId.startsWith('group:')) {
          nextGroups.delete(payload.conversationId.slice(6));
        }

        return {
          unreadCountsByConversation: nextCounts,
          unreadUserIds: nextUsers,
          unreadGroupIds: nextGroups,
        };
      });
    });

    unsubscribeMessageDelivered = socketService.onMessageDelivered((payload) => {
      set((state) => ({
        messages: state.messages.map((msg) => {
          if (
            msg.id === payload.messageId &&
            (msg.status === 'sent' || msg.status === 'sending' || !msg.status)
          ) {
            return { ...msg, status: 'delivered' };
          }
          return msg;
        }),
      }));
    });

    unsubscribeMessagesRead = socketService.onMessagesRead((payload) => {
      const myId = useAuthStore.getState().user?.id;
      const currentConvo = get().activeConversation;
      const expectedConvoId = currentConvo
        ? currentConvo.type === 'direct'
          ? myId
            ? getDirectConversationId(myId, currentConvo.id)
            : `direct:${currentConvo.id}`
          : getGroupConversationId(currentConvo.id)
        : null;

      set((state) => ({
        partnerLastReadMessageId: payload.lastReadMessageId,
        messages: state.messages.map((msg) => {
          if (
            (!msg.conversationId ||
              msg.conversationId === payload.conversationId ||
              msg.conversationId === expectedConvoId) &&
            msg.senderId === myId &&
            payload.lastReadMessageId &&
            msg.id <= payload.lastReadMessageId
          ) {
            return { ...msg, status: 'read' };
          }
          return msg;
        }),
      }));
    });

    unsubscribeGroupMessagesRead = socketService.onGroupMessagesRead((payload) => {
      const myId = useAuthStore.getState().user?.id;
      const activeConvo = get().activeConversation;
      if (!activeConvo || activeConvo.type !== 'group' || activeConvo.id !== payload.groupId) {
        return;
      }

      set((state) => {
        const updatedGroupReadMap = {
          ...state.groupMemberLastReadMap,
          [payload.readerId]: payload.lastReadMessageId,
        };

        const activeGroup = activeConvo.group;
        const allMemberIds =
          activeGroup?.members?.map((m) => m.userId) || Object.keys(updatedGroupReadMap);
        const otherMemberIds = allMemberIds.filter((id) => id !== myId);

        return {
          groupMemberLastReadMap: updatedGroupReadMap,
          messages: state.messages.map((msg) => {
            if (msg.senderId === myId && msg.status !== 'read') {
              const allRead =
                otherMemberIds.length > 0 &&
                otherMemberIds.every((id) => {
                  const memberWatermark = updatedGroupReadMap[id];
                  return memberWatermark && msg.id <= memberWatermark;
                });

              if (allRead) {
                return { ...msg, status: 'read' };
              }
            }
            return msg;
          }),
        };
      });
    });

    unsubscribeDoubtStatus = socketService.onDoubtStatusChanged((payload) => {
      set((state) => ({
        messages: state.messages.map((msg) => {
          if (msg.id === payload.messageId) {
            return {
              ...msg,
              doubtStatus: payload.status,
              resolvedBy: payload.resolvedBy,
              resolvedByName: payload.resolvedByName,
              resolvedAt: payload.resolvedAt,
            };
          }
          return msg;
        }),
      }));
    });

    unsubscribeMessagePinned = socketService.onMessagePinned((payload) => {
      const currentConvo = get().activeConversation;
      if (!currentConvo) return;
      const currentUserId = useAuthStore.getState().user?.id;
      const activeConvoId =
        currentConvo.type === 'direct'
          ? currentUserId
            ? getDirectConversationId(currentUserId, currentConvo.id)
            : `direct:${currentConvo.id}`
          : getGroupConversationId(currentConvo.id);

      if (payload.conversationId === activeConvoId) {
        set((state) => {
          const existingFiltered = state.pinnedMessages.filter(
            (p) => p.messageId !== payload.pin.messageId,
          );
          const updated = [payload.pin, ...existingFiltered].slice(0, 5);
          return { pinnedMessages: updated, activePinIndex: 0 };
        });
      }
    });

    unsubscribeMessageUnpinned = socketService.onMessageUnpinned((payload) => {
      const currentConvo = get().activeConversation;
      if (!currentConvo) return;
      const currentUserId = useAuthStore.getState().user?.id;
      const activeConvoId =
        currentConvo.type === 'direct'
          ? currentUserId
            ? getDirectConversationId(currentUserId, currentConvo.id)
            : `direct:${currentConvo.id}`
          : getGroupConversationId(currentConvo.id);

      if (payload.conversationId === activeConvoId) {
        set((state) => {
          const updated = state.pinnedMessages.filter(
            (p) => p.messageId !== payload.messageId,
          );
          const nextIndex = Math.min(state.activePinIndex, Math.max(0, updated.length - 1));
          return { pinnedMessages: updated, activePinIndex: nextIndex };
        });
      }
    });
  },

  disconnectSocket: (isLogout = false) => {
    if (unsubscribeConn) {
      unsubscribeConn();
      unsubscribeConn = null;
    }
    if (unsubscribeDirect) {
      unsubscribeDirect();
      unsubscribeDirect = null;
    }
    if (unsubscribeGroup) {
      unsubscribeGroup();
      unsubscribeGroup = null;
    }
    if (unsubscribeUserPresence) {
      unsubscribeUserPresence();
      unsubscribeUserPresence = null;
    }
    if (unsubscribeGroupPresence) {
      unsubscribeGroupPresence();
      unsubscribeGroupPresence = null;
    }
    if (unsubscribeTyping) {
      unsubscribeTyping();
      unsubscribeTyping = null;
    }
    if (unsubscribeReadAck) {
      unsubscribeReadAck();
      unsubscribeReadAck = null;
    }
    if (unsubscribeMessageDelivered) {
      unsubscribeMessageDelivered();
      unsubscribeMessageDelivered = null;
    }
    if (unsubscribeMessagesRead) {
      unsubscribeMessagesRead();
      unsubscribeMessagesRead = null;
    }
    if (unsubscribeGroupMessagesRead) {
      unsubscribeGroupMessagesRead();
      unsubscribeGroupMessagesRead = null;
    }
    if (unsubscribeDoubtStatus) {
      unsubscribeDoubtStatus();
      unsubscribeDoubtStatus = null;
    }
    if (unsubscribeMessagePinned) {
      unsubscribeMessagePinned();
      unsubscribeMessagePinned = null;
    }
    if (unsubscribeMessageUnpinned) {
      unsubscribeMessageUnpinned();
      unsubscribeMessageUnpinned = null;
    }
    clearTypingSafetyTimers();

    const currentConvo = get().activeConversation;
    if (currentConvo) {
      if (currentConvo.type === 'direct') {
        socketService.unsubscribeUserPresence(currentConvo.id);
      } else {
        socketService.unsubscribeGroupPresence(currentConvo.id);
      }
    }

    socketService.disconnect(isLogout);
    set({ isSocketConnected: false, typingUsersByConversation: {} });
  },

  reset: () => {
    get().disconnectSocket(true);
    cancelConvoRequest();
    clearMarkReadTimer();
    if (messageAbortController) {
      messageAbortController.abort();
      messageAbortController = null;
    }
    cancelPinsRequest();
    set({
      users: [],
      groups: [],
      isLoadingConversations: false,
      conversationsError: null,
      activeConversation: null,
      activePresence: null,
      activeGroupPresence: null,
      isLoadingPresence: false,
      typingUsersByConversation: {},
      unreadCountsByConversation: {},
      unreadUserIds: new Set(),
      unreadGroupIds: new Set(),
      isSocketConnected: false,
      messages: [],
      isLoadingMessages: false,
      messageError: null,
      hasMoreMessages: false,
      oldestMessageCursor: null,
      isLoadingOlderMessages: false,
      hasNewerMessages: false,
      newestMessageCursor: null,
      isLoadingNewerMessages: false,
      isLoadingContext: false,
      unseenLiveCountWhileInHistory: 0,
      replyingTo: null,
      pinnedMessages: [],
      activePinIndex: 0,
      isLoadingPins: false,
    });
  },
}));

