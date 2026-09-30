import { create } from 'zustand';
import type { User, Group, ActiveConversation, ChatMessage } from '../types';
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

export const useChatStore = create<ChatState>((set, get) => ({
  users: [],
  groups: [],
  isLoadingConversations: false,
  conversationsError: null,

  activeConversation: null,

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
        get().fetchMessages(nextActive);
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
        messages: [],
        messageError: null,
      };
    });

    get().fetchMessages(conversation);
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

        set((state) => {
          if (
            state.messages.some(
              (m) =>
                m.id === incomingMsg.id ||
                (incomingMsg.clientMessageId &&
                  m.clientMessageId === incomingMsg.clientMessageId),
            )
          ) {
            return state;
          }
          return { messages: [...state.messages, incomingMsg] };
        });
      } else {
        set((state) => {
          const next = new Set(state.unreadUserIds);
          next.add(partnerId);
          return { unreadUserIds: next };
        });
      }
    });

    unsubscribeGroup = socketService.onGroupMessage((payload: IncomingGroupMessageEvent) => {
      const currentConvo = get().activeConversation;
      const { groupId } = payload;

      const isCurrentGroup =
        currentConvo && currentConvo.type === 'group' && currentConvo.id === groupId;

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
          if (
            state.messages.some(
              (m) =>
                m.id === incomingMsg.id ||
                (incomingMsg.clientMessageId &&
                  m.clientMessageId === incomingMsg.clientMessageId),
            )
          ) {
            return state;
          }
          return { messages: [...state.messages, incomingMsg] };
        });
      } else {
        set((state) => {
          const next = new Set(state.unreadGroupIds);
          next.add(groupId);
          return { unreadGroupIds: next };
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
    socketService.disconnect();
    set({ isSocketConnected: false });
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
      unreadUserIds: new Set(),
      unreadGroupIds: new Set(),
      isSocketConnected: false,
      messages: [],
      isLoadingMessages: false,
      messageError: null,
    });
  },
}));
