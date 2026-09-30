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
} from '../types';
import { getDirectConversationId, getGroupConversationId } from '../types';
import { fetchUsers } from '../services/userService';
import { fetchUserGroups } from '../services/groupService';
import {
  fetchDirectMessages,
  fetchGroupMessages,
  fetchUnreadCounts,
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

  // Actions
  fetchConversations: () => Promise<void>;
  selectConversation: (conversation: ActiveConversation | null) => void;
  fetchMessages: (targetConvo?: ActiveConversation) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  addGroup: (newGroup: Group) => void;
  initSocket: () => void;
  disconnectSocket: (isLogout?: boolean) => void;
  reset: () => void;
}

let convoAbortController: AbortController | null = null;
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
const typingSafetyTimers = new Map<string, ReturnType<typeof setTimeout>>();

let markReadDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedMarkRead(conversationId: string, lastReadMessageId?: string) {
  if (markReadDebounceTimer) {
    clearTimeout(markReadDebounceTimer);
  }
  markReadDebounceTimer = setTimeout(() => {
    socketService.markRead(conversationId, lastReadMessageId);
    markReadDebounceTimer = null;
  }, 250);
}

export const useChatStore = create<ChatState>((set, get) => ({
  users: [],
  groups: [],
  isLoadingConversations: false,
  conversationsError: null,

  activeConversation: null,
  activePresence: null,
  activeGroupPresence: null,
  isLoadingPresence: false,

  partnerLastReadMessageId: null,
  groupMemberLastReadMap: {},

  typingUsersByConversation: {},

  unreadCountsByConversation: {},
  unreadUserIds: new Set<string>(),
  unreadGroupIds: new Set<string>(),

  getConversationUnreadCount: (conversationId: string) => {
    return get().unreadCountsByConversation[conversationId] || 0;
  },

  markConversationRead: (conversationId: string, lastReadMessageId?: string) => {
    debouncedMarkRead(conversationId, lastReadMessageId);
    set((state) => {
      const nextCounts = { ...state.unreadCountsByConversation, [conversationId]: 0 };
      const nextUsers = new Set(state.unreadUserIds);
      const nextGroups = new Set(state.unreadGroupIds);

      const currentUserId = useAuthStore.getState().user?.id;
      if (conversationId.startsWith('direct:') && currentUserId) {
        const parts = conversationId.slice(7).split(':');
        const partner = parts.find((id) => id !== currentUserId);
        if (partner) nextUsers.delete(partner);
      } else if (conversationId.startsWith('group:')) {
        nextGroups.delete(conversationId.slice(6));
      }

      return {
        unreadCountsByConversation: nextCounts,
        unreadUserIds: nextUsers,
        unreadGroupIds: nextGroups,
      };
    });
  },

  isSocketConnected: false,

  messages: [],
  isLoadingMessages: false,
  messageError: null,

  fetchConversations: async () => {
    const token = useAuthStore.getState().accessToken;
    const currentUserId = useAuthStore.getState().user?.id || null;

    if (!token) return;

    if (convoAbortController) {
      convoAbortController.abort();
    }
    convoAbortController = new AbortController();
    const signal = convoAbortController.signal;

    set({
      isLoadingConversations: true,
      conversationsError: null,
    });

    try {
      const [fetchedUsers, fetchedGroups, fetchedUnreadCounts] = await Promise.all([
        fetchUsers(token, signal),
        fetchUserGroups(token, signal).catch((err) => {
          console.error('Failed to fetch user groups:', err);
          return [] as Group[];
        }),
        fetchUnreadCounts(token, signal).catch((err) => {
          console.warn('Failed to fetch unread counts:', err);
          return {} as Record<string, number>;
        }),
      ]);

      if (signal.aborted) return;

      const nextUnreadUsers = new Set<string>();
      const nextUnreadGroups = new Set<string>();
      for (const [convoId, count] of Object.entries(fetchedUnreadCounts)) {
        if (count > 0) {
          if (convoId.startsWith('direct:') && currentUserId) {
            const parts = convoId.slice(7).split(':');
            const partner = parts.find((id) => id !== currentUserId);
            if (partner) nextUnreadUsers.add(partner);
          } else if (convoId.startsWith('group:')) {
            nextUnreadGroups.add(convoId.slice(6));
          }
        }
      }

      // Auto-select first available conversation if none active or invalid
      let nextActive = get().activeConversation;
      if (nextActive) {
        const activeId = nextActive.id;
        const isDirectStillValid =
          nextActive.type === 'direct' && fetchedUsers.some((u) => u.id === activeId);
        const isGroupStillValid =
          nextActive.type === 'group' && fetchedGroups.some((g) => g.id === activeId);

        if (!isDirectStillValid && !isGroupStillValid) {
          nextActive = null;
        }
      }

      const isDesktop = typeof window !== 'undefined' ? window.innerWidth > 768 : true;
      if (!nextActive && isDesktop) {
        const firstOther = fetchedUsers.find((u) => u.id !== currentUserId);
        if (firstOther) {
          nextActive = { type: 'direct', id: firstOther.id, user: firstOther };
        } else if (fetchedGroups.length > 0) {
          nextActive = { type: 'group', id: fetchedGroups[0].id, group: fetchedGroups[0] };
        }
      }

      set({
        users: fetchedUsers,
        groups: fetchedGroups,
        unreadCountsByConversation: fetchedUnreadCounts,
        unreadUserIds: nextUnreadUsers,
        unreadGroupIds: nextUnreadGroups,
        isLoadingConversations: false,
        conversationsError: null,
        activeConversation: nextActive,
      });

      if (nextActive && isDesktop) {
        get().selectConversation(nextActive);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to fetch conversations';
      if (message.includes('Unauthorized')) {
        useAuthStore.getState().logout();
        return;
      }
      set({
        isLoadingConversations: false,
        conversationsError: message,
      });
    }
  },

  selectConversation: (conversation) => {
    const prevConvo = get().activeConversation;
    if (prevConvo) {
      if (prevConvo.type === 'direct') {
        socketService.sendTypingStop({ recipientId: prevConvo.id });
        socketService.unsubscribeUserPresence(prevConvo.id);
      } else {
        socketService.sendTypingStop({ groupId: prevConvo.id });
        socketService.unsubscribeGroupPresence(prevConvo.id);
      }
    }

    if (!conversation) {
      if (messageAbortController) {
        messageAbortController.abort();
        messageAbortController = null;
      }
      set({
        activeConversation: null,
        activePresence: null,
        activeGroupPresence: null,
        isLoadingPresence: false,
        partnerLastReadMessageId: null,
        groupMemberLastReadMap: {},
        messages: [],
        messageError: null,
      });
      return;
    }

    const currentUserId = useAuthStore.getState().user?.id;
    const convoId =
      conversation.type === 'direct'
        ? currentUserId
          ? getDirectConversationId(currentUserId, conversation.id)
          : `direct:${conversation.id}`
        : getGroupConversationId(conversation.id);

    set((state) => {
      const nextUnreadUsers = new Set(state.unreadUserIds);
      const nextUnreadGroups = new Set(state.unreadGroupIds);
      const nextCounts = { ...state.unreadCountsByConversation, [convoId]: 0 };

      if (conversation.type === 'direct') {
        nextUnreadUsers.delete(conversation.id);
      } else {
        nextUnreadGroups.delete(conversation.id);
      }

      return {
        activeConversation: conversation,
        unreadCountsByConversation: nextCounts,
        unreadUserIds: nextUnreadUsers,
        unreadGroupIds: nextUnreadGroups,
        activePresence: null,
        activeGroupPresence: null,
        isLoadingPresence: true,
        partnerLastReadMessageId: null,
        groupMemberLastReadMap: {},
        messages: [],
        messageError: null,
      };
    });

    socketService.markRead(convoId);

    get().fetchMessages(conversation);

    if (conversation.type === 'direct') {
      socketService
        .subscribeUserPresence(conversation.id)
        .then((presence) => {
          if (get().activeConversation?.id === conversation.id) {
            set({ activePresence: presence, isLoadingPresence: false });
          }
        })
        .catch((err) => {
          console.warn('Failed to subscribe to user presence:', err);
          if (get().activeConversation?.id === conversation.id) {
            set({ isLoadingPresence: false });
          }
        });
    } else {
      socketService
        .subscribeGroupPresence(conversation.id)
        .then((presence) => {
          if (get().activeConversation?.id === conversation.id) {
            set({ activeGroupPresence: presence, isLoadingPresence: false });
          }
        })
        .catch((err) => {
          console.warn('Failed to subscribe to group presence:', err);
          if (get().activeConversation?.id === conversation.id) {
            set({ isLoadingPresence: false });
          }
        });
    }
  },

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
        ? await fetchGroupMessages(token, targetId, signal)
        : await fetchDirectMessages(token, targetId, signal);

      if (signal.aborted) return;

      const partnerLastRead = response.partnerLastReadMessageId || null;
      const memberLastReadMap = response.memberLastReadMap || {};

      const pastMessages: ChatMessage[] = (response.messages || []).map((m) => {
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
          timestamp: formattedTime,
          status,
        };
      });

      set((state) => {
        const existingThisConvo = state.messages.filter(
          (m) => !expectedConvoId || m.conversationId === expectedConvoId,
        );
        const merged = [...pastMessages];
        for (const msg of existingThisConvo) {
          if (
            !merged.some(
              (m) =>
                m.id === msg.id ||
                (msg.clientMessageId && m.clientMessageId === msg.clientMessageId),
            )
          ) {
            merged.push(msg);
          }
        }
        return {
          messages: merged,
          partnerLastReadMessageId: partnerLastRead,
          groupMemberLastReadMap: memberLastReadMap,
          isLoadingMessages: false,
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
        messageError: errorMsg,
      });
    }
  },

  sendMessage: async (text: string) => {
    const activeConversation = get().activeConversation;
    const currentUserId = useAuthStore.getState().user?.id;
    if (!text.trim() || !activeConversation || !currentUserId) return;

    const trimmedText = text.trim();
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

    const optimisticMessage: ChatMessage = {
      id: clientMessageId,
      conversationId: expectedConvoId,
      clientMessageId,
      senderId: currentUserId,
      receiverId: !isGroup ? activeConversation.id : undefined,
      groupId: isGroup ? activeConversation.id : undefined,
      text: trimmedText,
      timestamp: formattedTime,
      status: 'sending',
    };

    set((state) => ({ messages: [...state.messages, optimisticMessage] }));

    try {
      if (isGroup) {
        const ack = await socketService.sendGroupMessage(
          activeConversation.id,
          trimmedText,
          clientMessageId,
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

  sendTypingStart: () => {
    const active = get().activeConversation;
    if (!active) return;
    if (active.type === 'direct') {
      socketService.sendTypingStart({ recipientId: active.id });
    } else {
      socketService.sendTypingStart({ groupId: active.id });
    }
  },

  sendTypingStop: () => {
    const active = get().activeConversation;
    if (!active) return;
    if (active.type === 'direct') {
      socketService.sendTypingStop({ recipientId: active.id });
    } else {
      socketService.sendTypingStop({ groupId: active.id });
    }
  },

  addGroup: (newGroup: Group) => {
    const newConvo: ActiveConversation = {
      type: 'group',
      id: newGroup.id,
      group: newGroup,
    };
    set((state) => ({
      groups: [newGroup, ...state.groups],
      activeConversation: newConvo,
      messages: [],
      messageError: null,
    }));
    get().fetchMessages(newConvo);
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
          timestamp: formattedTime,
          status: 'sent',
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

          if (
            state.messages.some(
              (m) =>
                m.id === incomingMsg.id ||
                (incomingMsg.clientMessageId &&
                  m.clientMessageId === incomingMsg.clientMessageId),
            )
          ) {
            return {
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
          timestamp: formattedTime,
          status: 'sent',
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

          if (
            state.messages.some(
              (m) =>
                m.id === incomingMsg.id ||
                (incomingMsg.clientMessageId &&
                  m.clientMessageId === incomingMsg.clientMessageId),
            )
          ) {
            return {
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
    for (const timer of typingSafetyTimers.values()) {
      clearTimeout(timer);
    }
    typingSafetyTimers.clear();

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
    if (convoAbortController) {
      convoAbortController.abort();
      convoAbortController = null;
    }
    if (messageAbortController) {
      messageAbortController.abort();
      messageAbortController = null;
    }
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
    });
  },
}));
