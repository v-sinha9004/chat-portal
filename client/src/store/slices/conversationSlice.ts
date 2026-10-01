import type { ChatSlice, ConversationSlice } from './types';
import type { ActiveConversation, Group } from '../../types';
import { getDirectConversationId, getGroupConversationId } from '../../types';
import { fetchUsers } from '../../services/userService';
import { fetchUserGroups, fetchGroupDetails } from '../../services/groupService';
import { fetchUnreadCounts } from '../../services/chatService';
import { socketService } from '../../services/socketService';
import { useAuthStore } from '../useAuthStore';

let convoAbortController: AbortController | null = null;

export const cancelConvoRequest = () => {
  if (convoAbortController) {
    convoAbortController.abort();
    convoAbortController = null;
  }
};

export const createConversationSlice: ChatSlice<ConversationSlice> = (set, get) => ({
  users: [],
  groups: [],
  isLoadingConversations: false,
  conversationsError: null,
  activeConversation: null,

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
      set({
        activeConversation: null,
        activePresence: null,
        activeGroupPresence: null,
        isLoadingPresence: false,
        partnerLastReadMessageId: null,
        groupMemberLastReadMap: {},
        messages: [],
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
        isLoadingPins: true,
      };
    });

    socketService.markRead(convoId);

    get().fetchMessages(conversation);
    get().fetchPinnedMessages(convoId);

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
      const token = useAuthStore.getState().accessToken;
      if (token && (!conversation.group.members || conversation.group.members.length === 0)) {
        fetchGroupDetails(token, conversation.id)
          .then((detailedGroup) => {
            if (get().activeConversation?.id === conversation.id) {
              set((state) => {
                if (
                  state.activeConversation?.type === 'group' &&
                  state.activeConversation.id === conversation.id
                ) {
                  return {
                    activeConversation: {
                      ...state.activeConversation,
                      group: { ...state.activeConversation.group, ...detailedGroup },
                    },
                    groups: state.groups.map((g) =>
                      g.id === conversation.id ? { ...g, ...detailedGroup } : g,
                    ),
                  };
                }
                return state;
              });
            }
          })
          .catch((err) => console.warn('Failed to load group details with members:', err));
      }

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
});
