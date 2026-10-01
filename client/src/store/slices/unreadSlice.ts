import type { ChatSlice, UnreadSlice } from './types';
import { socketService } from '../../services/socketService';
import { useAuthStore } from '../useAuthStore';

let markReadDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const debouncedMarkRead = (conversationId: string, lastReadMessageId?: string) => {
  if (markReadDebounceTimer) {
    clearTimeout(markReadDebounceTimer);
  }
  markReadDebounceTimer = setTimeout(() => {
    socketService.markRead(conversationId, lastReadMessageId);
    markReadDebounceTimer = null;
  }, 250);
};

export const clearMarkReadTimer = () => {
  if (markReadDebounceTimer) {
    clearTimeout(markReadDebounceTimer);
    markReadDebounceTimer = null;
  }
};

export const createUnreadSlice: ChatSlice<UnreadSlice> = (set, get) => ({
  unreadCountsByConversation: {},
  unreadUserIds: new Set<string>(),
  unreadGroupIds: new Set<string>(),
  partnerLastReadMessageId: null,
  groupMemberLastReadMap: {},

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

  incrementUnread: (convoId: string, entityId: string, isGroup: boolean) => {
    set((state) => {
      const nextCounts = {
        ...state.unreadCountsByConversation,
        [convoId]: (state.unreadCountsByConversation[convoId] || 0) + 1,
      };
      if (isGroup) {
        const nextGroups = new Set(state.unreadGroupIds);
        nextGroups.add(entityId);
        return { unreadCountsByConversation: nextCounts, unreadGroupIds: nextGroups };
      } else {
        const nextUsers = new Set(state.unreadUserIds);
        nextUsers.add(entityId);
        return { unreadCountsByConversation: nextCounts, unreadUserIds: nextUsers };
      }
    });
  },

  applyReadAck: (conversationId: string) => {
    const currentUserId = useAuthStore.getState().user?.id;
    set((state) => {
      const nextCounts = {
        ...state.unreadCountsByConversation,
        [conversationId]: 0,
      };
      const nextUsers = new Set(state.unreadUserIds);
      const nextGroups = new Set(state.unreadGroupIds);

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
});
