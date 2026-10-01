import type { ChatSlice, PresenceSlice } from './types';
import { socketService } from '@/services';
import { useAuthStore } from '../useAuthStore';

export const typingSafetyTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const clearTypingSafetyTimers = () => {
  for (const timer of typingSafetyTimers.values()) {
    clearTimeout(timer);
  }
  typingSafetyTimers.clear();
};

export const createPresenceSlice: ChatSlice<PresenceSlice> = (set, get) => ({
  activePresence: null,
  activeGroupPresence: null,
  isLoadingPresence: false,
  typingUsersByConversation: {},

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

  clearTypingUser: (convKey: string, userId: string) => {
    const timerKey = `${convKey}:${userId}`;
    if (typingSafetyTimers.has(timerKey)) {
      clearTimeout(typingSafetyTimers.get(timerKey)!);
      typingSafetyTimers.delete(timerKey);
    }
    set((state) => {
      const current = state.typingUsersByConversation[convKey] || [];
      if (!current.includes(userId)) return state;
      return {
        typingUsersByConversation: {
          ...state.typingUsersByConversation,
          [convKey]: current.filter((id) => id !== userId),
        },
      };
    });
  },

  handleTypingEvent: (event) => {
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
  },

  handleUserPresenceChange: (userId: string, isOnline: boolean, lastSeen?: string | null) => {
    const currentConvo = get().activeConversation;
    if (currentConvo && currentConvo.type === 'direct' && currentConvo.id === userId) {
      set({
        activePresence: {
          userId,
          isOnline,
          lastSeen: lastSeen ?? null,
        },
        isLoadingPresence: false,
      });
    }
  },

  handleGroupPresenceChange: (groupId: string, userId: string, isOnline: boolean) => {
    const currentConvo = get().activeConversation;
    if (currentConvo && currentConvo.type === 'group' && currentConvo.id === groupId) {
      set((state) => {
        if (!state.activeGroupPresence) return state;
        const currentMembers = new Set(state.activeGroupPresence.onlineMemberIds);
        if (isOnline) {
          currentMembers.add(userId);
        } else {
          currentMembers.delete(userId);
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
  },
});
