import { useShallow } from 'zustand/react/shallow';
import { useChatStore } from './useChatStore';

// ==========================================
// 1. ACTIONS HOOK (Static functions, never trigger re-renders on state changes)
// ==========================================
export const useChatActions = () =>
  useChatStore(
    useShallow((s) => ({
      // Messages
      sendMessage: s.sendMessage,
      fetchMessages: s.fetchMessages,
      loadOlderMessages: s.loadOlderMessages,
      loadNewerMessages: s.loadNewerMessages,
      jumpToMessage: s.jumpToMessage,
      jumpToLatest: s.jumpToLatest,
      setReplyingTo: s.setReplyingTo,
      updateDoubtStatus: s.updateDoubtStatus,
      removeDeletedMessage: s.removeDeletedMessage,

      // Pins
      fetchPinnedMessages: s.fetchPinnedMessages,
      pinMessage: s.pinMessage,
      unpinMessage: s.unpinMessage,
      setActivePinIndex: s.setActivePinIndex,
      nextPin: s.nextPin,
      prevPin: s.prevPin,
      // Conversations
      fetchConversations: s.fetchConversations,
      selectConversation: s.selectConversation,
      addGroup: s.addGroup,
      // Presence & Typing
      sendTypingStart: s.sendTypingStart,
      sendTypingStop: s.sendTypingStop,
      // Unread
      getConversationUnreadCount: s.getConversationUnreadCount,
      markConversationRead: s.markConversationRead,
      // Socket & Global
      initSocket: s.initSocket,
      disconnectSocket: s.disconnectSocket,
      reset: s.reset,
    })),
  );

// ==========================================
// 2. MESSAGE WINDOW STATE
// ==========================================
export const useMessageWindowState = () =>
  useChatStore(
    useShallow((s) => ({
      messages: s.messages,
      isLoadingMessages: s.isLoadingMessages,
      messageError: s.messageError,
      hasMoreMessages: s.hasMoreMessages,
      isLoadingOlderMessages: s.isLoadingOlderMessages,
      hasNewerMessages: s.hasNewerMessages,
      isLoadingNewerMessages: s.isLoadingNewerMessages,
      isLoadingContext: s.isLoadingContext,
      unseenLiveCountWhileInHistory: s.unseenLiveCountWhileInHistory,
      replyingTo: s.replyingTo,
    })),
  );

// ==========================================
// 3. PRESENCE STATE
// ==========================================
export const usePresenceState = () =>
  useChatStore(
    useShallow((s) => ({
      activePresence: s.activePresence,
      activeGroupPresence: s.activeGroupPresence,
      isLoadingPresence: s.isLoadingPresence,
      typingUsersByConversation: s.typingUsersByConversation,
    })),
  );

// ==========================================
// 4. PINS STATE
// ==========================================
export const usePinsState = () =>
  useChatStore(
    useShallow((s) => ({
      pinnedMessages: s.pinnedMessages,
      activePinIndex: s.activePinIndex,
      isLoadingPins: s.isLoadingPins,
    })),
  );

// ==========================================
// 5. CONVERSATION STATE
// ==========================================
export const useConversationState = () =>
  useChatStore(
    useShallow((s) => ({
      users: s.users,
      groups: s.groups,
      activeConversation: s.activeConversation,
      isLoadingConversations: s.isLoadingConversations,
      conversationsError: s.conversationsError,
      isSocketConnected: s.isSocketConnected,
    })),
  );

// ==========================================
// 6. UNREAD STATE
// ==========================================
export const useUnreadState = () =>
  useChatStore(
    useShallow((s) => ({
      unreadCountsByConversation: s.unreadCountsByConversation,
      unreadUserIds: s.unreadUserIds,
      unreadGroupIds: s.unreadGroupIds,
    })),
  );
