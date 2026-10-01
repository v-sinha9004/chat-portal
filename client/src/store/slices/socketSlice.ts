import type { ChatSlice, SocketSlice } from './types';
import type { ChatMessage } from '@/types';
import { getDirectConversationId, getGroupConversationId } from '@/types';
import {
  socketService,
  type IncomingDirectMessageEvent,
  type IncomingGroupMessageEvent,
} from '@/services';
import { useAuthStore } from '../useAuthStore';
import { clearTypingSafetyTimers } from './presenceSlice';
import { debouncedMarkRead } from './unreadSlice';

let unsubscribeConn: (() => void) | null = null;
let unsubscribeDirect: (() => void) | null = null;
let unsubscribeGroup: (() => void) | null = null;
let unsubscribeUserPresence: (() => void) | null = null;
let unsubscribeGroupPresence: (() => void) | null = null;
let unsubscribeTyping: (() => void) | null = null;
let unsubscribeReadAck: (() => void) | null = null;
let unsubscribeMessageDelivered: (() => void) | null = null;
let unsubscribeMessagesRead: (() => void) | null = null;
let unsubscribeGroupMessagesRead: (() => void) | null = null;
let unsubscribeDoubtStatus: (() => void) | null = null;
let unsubscribeMessagePinned: (() => void) | null = null;
let unsubscribeMessageUnpinned: (() => void) | null = null;
let unsubscribeMessageDeleted: (() => void) | null = null;


export const createSocketSlice: ChatSlice<SocketSlice> = (set, get) => ({
  isSocketConnected: false,

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
                  get().handleUserPresenceChange(presence.userId, presence.isOnline, presence.lastSeen);
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

      const expectedConvoId = myId
        ? getDirectConversationId(myId, partnerId)
        : `direct:${partnerId}`;

      // Acknowledge delivery to sender so sender receives double tick ✓✓
      if (payload.id && partnerId !== myId) {
        socketService.ackDelivery(
          payload.conversationId || expectedConvoId,
          payload.id,
          partnerId,
        );
      }

      // Clear typing indicator for sender
      get().clearTypingUser(`user:${partnerId}`, partnerId);

      const isVisibleAndActive =
        isCurrentChat &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible';

      if (isCurrentChat) {
        const formattedTime = new Date(payload.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const incomingMsg: ChatMessage = {
          id: payload.id,
          conversationId: payload.conversationId || expectedConvoId,
          clientMessageId: payload.clientMessageId,
          senderId: payload.senderId,
          receiverId: payload.recipientId,
          text: payload.data?.message || '',
          attachments: payload.attachments || [],
          timestamp: formattedTime,
          status: 'sent',
          replyTo: payload.replyTo,
          isDoubt: payload.isDoubt,
          doubtStatus: payload.doubtStatus,
          doubtTopic: payload.doubtTopic,
          resolvedBy: payload.resolvedBy,
          resolvedByName: payload.resolvedByName,
          resolvedAt: payload.resolvedAt,
        };

        if (isVisibleAndActive) {
          debouncedMarkRead(expectedConvoId, payload.id);
        } else {
          get().incrementUnread(expectedConvoId, partnerId, false);
        }

        get().addIncomingMessage(incomingMsg);
      } else {
        get().incrementUnread(expectedConvoId, partnerId, false);
      }
    });

    unsubscribeGroup = socketService.onGroupMessage((payload: IncomingGroupMessageEvent) => {
      const currentConvo = get().activeConversation;
      const { groupId } = payload;
      const senderId = payload.senderId;
      const convoId = getGroupConversationId(groupId);

      const isCurrentGroup =
        currentConvo && currentConvo.type === 'group' && currentConvo.id === groupId;

      const isVisibleAndActive =
        isCurrentGroup &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible';

      // Clear typing indicator for sender
      get().clearTypingUser(`group:${groupId}`, senderId);

      if (isCurrentGroup) {
        const formattedTime = new Date(payload.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const incomingMsg: ChatMessage = {
          id: payload.id,
          conversationId: payload.conversationId || convoId,
          clientMessageId: payload.clientMessageId,
          senderId: payload.senderId,
          groupId: payload.groupId,
          text: payload.data?.message || '',
          attachments: payload.attachments || [],
          timestamp: formattedTime,
          status: 'sent',
          isAnnouncement: payload.isAnnouncement,
          heading: payload.heading,
          replyTo: payload.replyTo,
          isDoubt: payload.isDoubt,
          doubtStatus: payload.doubtStatus,
          doubtTopic: payload.doubtTopic,
          resolvedBy: payload.resolvedBy,
          resolvedByName: payload.resolvedByName,
          resolvedAt: payload.resolvedAt,
        };

        if (isVisibleAndActive) {
          debouncedMarkRead(convoId, payload.id);
        } else {
          get().incrementUnread(convoId, groupId, true);
        }

        get().addIncomingMessage(incomingMsg);
      } else {
        get().incrementUnread(convoId, groupId, true);
      }
    });

    unsubscribeUserPresence = socketService.onUserPresenceChanged((payload) => {
      get().handleUserPresenceChange(payload.userId, payload.isOnline, payload.lastSeen);
    });

    unsubscribeGroupPresence = socketService.onGroupPresenceChanged((payload) => {
      get().handleGroupPresenceChange(payload.groupId, payload.userId, payload.isOnline);
    });

    unsubscribeTyping = socketService.onUserTyping((event) => {
      get().handleTypingEvent(event);
    });

    unsubscribeReadAck = socketService.onConversationReadAck((payload) => {
      get().applyReadAck(payload.conversationId);
    });

    unsubscribeMessageDelivered = socketService.onMessageDelivered((payload) => {
      get().updateMessageDelivered(payload.messageId);
    });

    unsubscribeMessagesRead = socketService.onMessagesRead((payload) => {
      get().updatePartnerLastRead(payload.lastReadMessageId, payload.conversationId);
    });

    unsubscribeGroupMessagesRead = socketService.onGroupMessagesRead((payload) => {
      get().updateGroupMemberLastRead(payload.readerId, payload.lastReadMessageId, payload.groupId);
    });

    unsubscribeDoubtStatus = socketService.onDoubtStatusChanged((payload) => {
      get().applyDoubtStatusUpdate(payload.messageId, payload.status, {
        resolvedBy: payload.resolvedBy,
        resolvedByName: payload.resolvedByName,
        resolvedAt: payload.resolvedAt,
      });
    });

    unsubscribeMessagePinned = socketService.onMessagePinned((payload) => {
      get().handleSocketPin(payload.pin, payload.conversationId);
    });

    unsubscribeMessageUnpinned = socketService.onMessageUnpinned((payload) => {
      get().handleSocketUnpin(payload.messageId, payload.conversationId);
    });

    unsubscribeMessageDeleted = socketService.onMessageDeleted((payload) => {
      get().removeDeletedMessage(payload.messageId);
    });
  },


  disconnectSocket: (isLogout = false) => {
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
    if (unsubscribeReadAck) {
      unsubscribeReadAck();
      unsubscribeReadAck = null;
    }
    if (unsubscribeMessageDelivered) {
      unsubscribeMessageDelivered();
      unsubscribeMessageDelivered = null;
    }
    if (unsubscribeMessagesRead) {
      unsubscribeMessagesRead();
      unsubscribeMessagesRead = null;
    }
    if (unsubscribeGroupMessagesRead) {
      unsubscribeGroupMessagesRead();
      unsubscribeGroupMessagesRead = null;
    }
    if (unsubscribeDoubtStatus) {
      unsubscribeDoubtStatus();
      unsubscribeDoubtStatus = null;
    }
    if (unsubscribeMessagePinned) {
      unsubscribeMessagePinned();
      unsubscribeMessagePinned = null;
    }
    if (unsubscribeMessageUnpinned) {
      unsubscribeMessageUnpinned();
      unsubscribeMessageUnpinned = null;
    }
    if (unsubscribeMessageDeleted) {
      unsubscribeMessageDeleted();
      unsubscribeMessageDeleted = null;
    }
    clearTypingSafetyTimers();


    const currentConvo = get().activeConversation;
    if (currentConvo) {
      if (currentConvo.type === 'direct') {
        socketService.unsubscribeUserPresence(currentConvo.id);
      } else {
        socketService.unsubscribeGroupPresence(currentConvo.id);
      }
    }

    socketService.disconnect(isLogout);
    set({ isSocketConnected: false, typingUsersByConversation: {} });
  },
});
