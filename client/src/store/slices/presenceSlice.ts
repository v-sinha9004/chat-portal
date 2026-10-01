import type { ChatSlice, PresenceSlice } from './types';
import { socketService } from '../../services/socketService';

export const typingSafetyTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const clearTypingSafetyTimers = () => {
  for (const timer of typingSafetyTimers.values()) {
    clearTimeout(timer);
  }
  typingSafetyTimers.clear();
};

export const createPresenceSlice: ChatSlice<PresenceSlice> = (_set, get) => ({
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
});
