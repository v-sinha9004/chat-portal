import type { ChatSlice, PinSlice } from './types';
import { useAuthStore } from '../useAuthStore';
import { getDirectConversationId, getGroupConversationId } from '../../types';
import {
  fetchPinnedMessages,
  pinMessageRest,
  unpinMessageRest,
} from '../../services/chatService';

let pinsAbortController: AbortController | null = null;

export const cancelPinsRequest = () => {
  if (pinsAbortController) {
    pinsAbortController.abort();
    pinsAbortController = null;
  }
};

export const createPinSlice: ChatSlice<PinSlice> = (set, get) => ({
  pinnedMessages: [],
  activePinIndex: 0,
  isLoadingPins: false,

  fetchPinnedMessages: async (conversationId?: string) => {
    const convo = get().activeConversation;
    const token = useAuthStore.getState().accessToken;
    const currentUserId = useAuthStore.getState().user?.id;
    if (!token || (!convo && !conversationId)) return;

    const targetConvoId =
      conversationId ||
      (convo?.type === 'direct'
        ? currentUserId
          ? getDirectConversationId(currentUserId, convo.id)
          : `direct:${convo?.id}`
        : getGroupConversationId(convo!.id));

    if (pinsAbortController) {
      pinsAbortController.abort();
    }
    pinsAbortController = new AbortController();

    set({ isLoadingPins: true });
    try {
      const pins = await fetchPinnedMessages(token, targetConvoId, pinsAbortController.signal);
      set({ pinnedMessages: pins || [], activePinIndex: 0, isLoadingPins: false });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to fetch pinned messages:', err);
      set({ isLoadingPins: false });
    }
  },

  pinMessage: async (messageId: string): Promise<boolean> => {
    const convo = get().activeConversation;
    const token = useAuthStore.getState().accessToken;
    const currentUserId = useAuthStore.getState().user?.id;
    if (!token || !convo || !messageId) return false;

    const targetConvoId =
      convo.type === 'direct'
        ? currentUserId
          ? getDirectConversationId(currentUserId, convo.id)
          : `direct:${convo.id}`
        : getGroupConversationId(convo.id);

    try {
      const newPin = await pinMessageRest(token, targetConvoId, messageId);
      set((state) => {
        const filtered = state.pinnedMessages.filter((p) => p.messageId !== messageId);
        const updated = [newPin, ...filtered].slice(0, 5);
        return { pinnedMessages: updated, activePinIndex: 0 };
      });
      return true;
    } catch (err) {
      console.error('Failed to pin message:', err);
      return false;
    }
  },

  unpinMessage: async (messageId: string): Promise<boolean> => {
    const convo = get().activeConversation;
    const token = useAuthStore.getState().accessToken;
    const currentUserId = useAuthStore.getState().user?.id;
    if (!token || !convo || !messageId) return false;

    const targetConvoId =
      convo.type === 'direct'
        ? currentUserId
          ? getDirectConversationId(currentUserId, convo.id)
          : `direct:${convo.id}`
        : getGroupConversationId(convo.id);

    try {
      await unpinMessageRest(token, targetConvoId, messageId);
      set((state) => {
        const updated = state.pinnedMessages.filter((p) => p.messageId !== messageId);
        const nextIndex = Math.min(state.activePinIndex, Math.max(0, updated.length - 1));
        return { pinnedMessages: updated, activePinIndex: nextIndex };
      });
      return true;
    } catch (err) {
      console.error('Failed to unpin message:', err);
      return false;
    }
  },

  setActivePinIndex: (index: number) => {
    const len = get().pinnedMessages.length;
    if (len === 0) {
      set({ activePinIndex: 0 });
      return;
    }
    const clamped = Math.max(0, Math.min(index, len - 1));
    set({ activePinIndex: clamped });
  },

  nextPin: () => {
    const len = get().pinnedMessages.length;
    if (len <= 1) return;
    set((state) => ({
      activePinIndex: (state.activePinIndex + 1) % len,
    }));
  },

  prevPin: () => {
    const len = get().pinnedMessages.length;
    if (len <= 1) return;
    set((state) => ({
      activePinIndex: (state.activePinIndex - 1 + len) % len,
    }));
  },
});
