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
import { fetchUsers } from '../services/userService';
import { fetchUserGroups } from '../services/groupService';
import { fetchDirectMessages, fetchGroupMessages } from '../services/chatService';
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

  // Unread Sets
  unreadUserIds: Set<string>;
  unreadGroupIds: Set<string>;

  // Socket State
  isSocketConnected: boolean;

  // Active Chat Messages
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  messageError: string | null;

  // Actions
  fetchConversations: () => Promise<void>;
  selectConversation: (conversation: ActiveConversation) => void;
  fetchMessages: (targetConvo?: ActiveConversation) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  addGroup: (newGroup: Group) => void;
  initSocket: () => void;
  disconnectSocket: () => void;
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
const typingSafetyTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useChatStore = create<ChatState>((set, get) => ({
  users: [],
  groups: [],
  isLoadingConversations: false,
  conversationsError: null,

  activeConversation: null,
  activePresence: null,
  activeGroupPresence: null,
  isLoadingPresence: false,

  typingUsersByConversation: {},

  unreadUserIds: new Set<string>(),
  unreadGroupIds: new Set<string>(),

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
      const [fetchedUsers, fetchedGroups] = await Promise.all([
        fetchUsers(token, signal),
        fetchUserGroups(token, signal).catch((err) => {
          console.error('Failed to fetch user groups:', err);
          return [] as Group[];
        }),
      ]);

      if (signal.aborted) return;

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

      if (!nextActive) {
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
        isLoadingConversations: false,
        conversationsError: null,
        activeConversation: nextActive,
      });

      if (nextActive) {
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

    set((state) => {
      const nextUnreadUsers = new Set(state.unreadUserIds);
      const nextUnreadGroups = new Set(state.unreadGroupIds);

      if (conversation.type === 'direct') {
        nextUnreadUsers.delete(conversation.id);
      } else {
        nextUnreadGroups.delete(conversation.id);
      }

      return {
        activeConversation: conversation,
        unreadUserIds: nextUnreadUsers,
        unreadGroupIds: nextUnreadGroups,
        activePresence: null,
        activeGroupPresence: null,
        isLoadingPresence: true,
        messages: [],
        messageError: null,
      };
    });

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

      const pastMessages: ChatMessage[] = (response.messages || []).map((m) => {
        const formattedTime = new Date(m.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        return {
          id: m.id || m.messageId,
          conversationId: m.conversationId,
          clientMessageId: m.clientMessageId,
          senderId: m.senderId,
          receiverId: m.recipientId,
          groupId: m.groupId,
          text: m.text || m.content || '',
          timestamp: formattedTime,
          status: 'sent',
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
          isLoadingMessages: false,
          messageError: null,
        };
      });
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

      if (isCurrentChat) {
        const formattedTime = new Date(payload.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const expectedConvoId = myId
          ? `direct:${[myId, currentConvo.id].sort().join(':')}`
          : undefined;

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

        set((state) => {
          const currentTyping = state.typingUsersByConversation[`user:${partnerId}`] || [];
          const updatedTyping = currentTyping.filter((id) => id !== partnerId);

          if (
            state.messages.some(
              (m) =>
                m.id === incomingMsg.id ||
                (incomingMsg.clientMessageId &&
                  m.clientMessageId === incomingMsg.clientMessageId),
            )
          ) {
            return {
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`user:${partnerId}`]: updatedTyping,
              },
            };
          }
          return {
            messages: [...state.messages, incomingMsg],
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
          const currentTyping = state.typingUsersByConversation[`user:${partnerId}`] || [];
          return {
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

      const isCurrentGroup =
        currentConvo && currentConvo.type === 'group' && currentConvo.id === groupId;

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
          conversationId: payload.conversationId || `group:${groupId}`,
          clientMessageId: payload.clientMessageId,
          senderId: payload.senderId,
          groupId: payload.groupId,
          text: payload.data?.message || '',
          timestamp: formattedTime,
          status: 'sent',
        };

        set((state) => {
          const currentTyping = state.typingUsersByConversation[`group:${groupId}`] || [];
          const updatedTyping = currentTyping.filter((id) => id !== senderId);

          if (
            state.messages.some(
              (m) =>
                m.id === incomingMsg.id ||
                (incomingMsg.clientMessageId &&
                  m.clientMessageId === incomingMsg.clientMessageId),
            )
          ) {
            return {
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`group:${groupId}`]: updatedTyping,
              },
            };
          }
          return {
            messages: [...state.messages, incomingMsg],
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
          const currentTyping = state.typingUsersByConversation[`group:${groupId}`] || [];
          return {
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
  },

  disconnectSocket: () => {
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

    socketService.disconnect();
    set({ isSocketConnected: false, typingUsersByConversation: {} });
  },

  reset: () => {
    get().disconnectSocket();
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
      unreadUserIds: new Set(),
      unreadGroupIds: new Set(),
      isSocketConnected: false,
      messages: [],
      isLoadingMessages: false,
      messageError: null,
    });
  },
}));
