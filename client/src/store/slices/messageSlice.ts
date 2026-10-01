import type { ChatSlice, MessageSlice } from './types';
import type { ActiveConversation, ChatMessage, AttachmentInfo, ReplyToInfo } from '../../types';
import {
  fetchDirectMessages,
  fetchGroupMessages,
  fetchMessageContext,
  updateDoubtStatusRest,
} from '../../services/chatService';
import { socketService } from '../../services/socketService';
import { useAuthStore } from '../useAuthStore';
import { mapHistoryMessageToChatMessage } from '../utils/messageHelpers';
import { debouncedMarkRead } from './unreadSlice';

let messageAbortController: AbortController | null = null;

export const cancelMessageRequest = () => {
  if (messageAbortController) {
    messageAbortController.abort();
    messageAbortController = null;
  }
};

export const createMessageSlice: ChatSlice<MessageSlice> = (set, get) => ({
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

  setReplyingTo: (message: ChatMessage | null) => set({ replyingTo: message }),

  fetchMessages: async (targetConvo?: ActiveConversation) => {
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
});
