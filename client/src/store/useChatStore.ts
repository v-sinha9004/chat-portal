import { create } from 'zustand';
import { createPinSlice, cancelPinsRequest } from './slices/pinSlice';
import { createPresenceSlice } from './slices/presenceSlice';
import { createUnreadSlice, clearMarkReadTimer } from './slices/unreadSlice';
import { createConversationSlice, cancelConvoRequest } from './slices/conversationSlice';
import { createMessageSlice, cancelMessageRequest } from './slices/messageSlice';
import { createSocketSlice } from './slices/socketSlice';
import type { ChatState } from './slices/types';
export type { ChatState } from './slices/types';

export const useChatStore = create<ChatState>((set, get, api) => ({
  ...createPinSlice(set, get, api),
  ...createPresenceSlice(set, get, api),
  ...createUnreadSlice(set, get, api),
  ...createConversationSlice(set, get, api),
  ...createMessageSlice(set, get, api),
  ...createSocketSlice(set, get, api),

  reset: () => {
    get().disconnectSocket(true);
    cancelConvoRequest();
    clearMarkReadTimer();
    cancelMessageRequest();
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

