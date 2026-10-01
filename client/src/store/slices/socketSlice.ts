import type { ChatSlice, SocketSlice } from './types';
import type {
  ChatMessage,
  UserPresenceChangedEvent,
  GroupPresenceChangedEvent,
  UserTypingEvent,
} from '../../types';
import { getDirectConversationId, getGroupConversationId } from '../../types';
import {
  socketService,
  type IncomingDirectMessageEvent,
  type IncomingGroupMessageEvent,
} from '../../services/socketService';
import { useAuthStore } from '../useAuthStore';
import { typingSafetyTimers, clearTypingSafetyTimers } from './presenceSlice';
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
                  set({ activePresence: presence, isLoadingPresence: false });
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

        const directTimerKey = `user:${partnerId}:${partnerId}`;
        if (typingSafetyTimers.has(directTimerKey)) {
          clearTimeout(typingSafetyTimers.get(directTimerKey)!);
          typingSafetyTimers.delete(directTimerKey);
        }

        if (isVisibleAndActive) {
          debouncedMarkRead(expectedConvoId, payload.id);
        }

        set((state) => {
          const currentTyping = state.typingUsersByConversation[`user:${partnerId}`] || [];
          const updatedTyping = currentTyping.filter((id) => id !== partnerId);

          let nextCounts = state.unreadCountsByConversation;
          let nextUnreadUsers = state.unreadUserIds;
          if (!isVisibleAndActive) {
            nextCounts = {
              ...state.unreadCountsByConversation,
              [expectedConvoId]: (state.unreadCountsByConversation[expectedConvoId] || 0) + 1,
            };
            nextUnreadUsers = new Set(state.unreadUserIds);
            nextUnreadUsers.add(partnerId);
          }

          const existingIndex = state.messages.findIndex(
            (m) =>
              m.id === incomingMsg.id ||
              (incomingMsg.clientMessageId &&
                m.clientMessageId === incomingMsg.clientMessageId),
          );

          if (existingIndex !== -1) {
            const nextMessages = [...state.messages];
            nextMessages[existingIndex] = {
              ...nextMessages[existingIndex],
              ...incomingMsg,
            };
            return {
              messages: nextMessages,
              unreadCountsByConversation: nextCounts,
              unreadUserIds: nextUnreadUsers,
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`user:${partnerId}`]: updatedTyping,
              },
            };
          }

          if (state.hasNewerMessages) {
            return {
              unseenLiveCountWhileInHistory: state.unseenLiveCountWhileInHistory + 1,
              unreadCountsByConversation: nextCounts,
              unreadUserIds: nextUnreadUsers,
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`user:${partnerId}`]: updatedTyping,
              },
            };
          }

          return {
            messages: [...state.messages, incomingMsg],
            unreadCountsByConversation: nextCounts,
            unreadUserIds: nextUnreadUsers,
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [`user:${partnerId}`]: updatedTyping,
            },
          };
        });
      } else {
        const directTimerKey = `user:${partnerId}:${partnerId}`;
        if (typingSafetyTimers.has(directTimerKey)) {
          clearTimeout(typingSafetyTimers.get(directTimerKey)!);
          typingSafetyTimers.delete(directTimerKey);
        }

        set((state) => {
          const next = new Set(state.unreadUserIds);
          next.add(partnerId);
          const nextCounts = {
            ...state.unreadCountsByConversation,
            [expectedConvoId]: (state.unreadCountsByConversation[expectedConvoId] || 0) + 1,
          };
          const currentTyping = state.typingUsersByConversation[`user:${partnerId}`] || [];
          return {
            unreadCountsByConversation: nextCounts,
            unreadUserIds: next,
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [`user:${partnerId}`]: currentTyping.filter((id) => id !== partnerId),
            },
          };
        });
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

      const groupTimerKey = `group:${groupId}:${senderId}`;
      if (typingSafetyTimers.has(groupTimerKey)) {
        clearTimeout(typingSafetyTimers.get(groupTimerKey)!);
        typingSafetyTimers.delete(groupTimerKey);
      }

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
        }

        set((state) => {
          const currentTyping = state.typingUsersByConversation[`group:${groupId}`] || [];
          const updatedTyping = currentTyping.filter((id) => id !== senderId);

          let nextCounts = state.unreadCountsByConversation;
          let nextUnreadGroups = state.unreadGroupIds;
          if (!isVisibleAndActive) {
            nextCounts = {
              ...state.unreadCountsByConversation,
              [convoId]: (state.unreadCountsByConversation[convoId] || 0) + 1,
            };
            nextUnreadGroups = new Set(state.unreadGroupIds);
            nextUnreadGroups.add(groupId);
          }

          const existingIndex = state.messages.findIndex(
            (m) =>
              m.id === incomingMsg.id ||
              (incomingMsg.clientMessageId &&
                m.clientMessageId === incomingMsg.clientMessageId),
          );

          if (existingIndex !== -1) {
            const nextMessages = [...state.messages];
            nextMessages[existingIndex] = {
              ...nextMessages[existingIndex],
              ...incomingMsg,
              status: 'sent',
            };
            return {
              messages: nextMessages,
              unreadCountsByConversation: nextCounts,
              unreadGroupIds: nextUnreadGroups,
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`group:${groupId}`]: updatedTyping,
              },
            };
          }

          if (state.hasNewerMessages) {
            return {
              unseenLiveCountWhileInHistory: state.unseenLiveCountWhileInHistory + 1,
              unreadCountsByConversation: nextCounts,
              unreadGroupIds: nextUnreadGroups,
              typingUsersByConversation: {
                ...state.typingUsersByConversation,
                [`group:${groupId}`]: updatedTyping,
              },
            };
          }

          return {
            messages: [...state.messages, incomingMsg],
            unreadCountsByConversation: nextCounts,
            unreadGroupIds: nextUnreadGroups,
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [`group:${groupId}`]: updatedTyping,
            },
          };
        });
      } else {
        set((state) => {
          const next = new Set(state.unreadGroupIds);
          next.add(groupId);
          const nextCounts = {
            ...state.unreadCountsByConversation,
            [convoId]: (state.unreadCountsByConversation[convoId] || 0) + 1,
          };
          const currentTyping = state.typingUsersByConversation[`group:${groupId}`] || [];
          return {
            unreadCountsByConversation: nextCounts,
            unreadGroupIds: next,
            typingUsersByConversation: {
              ...state.typingUsersByConversation,
              [`group:${groupId}`]: currentTyping.filter((id) => id !== senderId),
            },
          };
        });
      }
    });

    unsubscribeUserPresence = socketService.onUserPresenceChanged((payload: UserPresenceChangedEvent) => {
      const currentConvo = get().activeConversation;
      if (currentConvo && currentConvo.type === 'direct' && currentConvo.id === payload.userId) {
        set({
          activePresence: {
            userId: payload.userId,
            isOnline: payload.isOnline,
            lastSeen: payload.lastSeen,
          },
          isLoadingPresence: false,
        });
      }
    });

    unsubscribeGroupPresence = socketService.onGroupPresenceChanged((payload: GroupPresenceChangedEvent) => {
      const currentConvo = get().activeConversation;
      if (currentConvo && currentConvo.type === 'group' && currentConvo.id === payload.groupId) {
        set((state) => {
          if (!state.activeGroupPresence) return state;
          const currentMembers = new Set(state.activeGroupPresence.onlineMemberIds);
          if (payload.isOnline) {
            currentMembers.add(payload.userId);
          } else {
            currentMembers.delete(payload.userId);
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
    });

    unsubscribeTyping = socketService.onUserTyping((event: UserTypingEvent) => {
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
    });

    unsubscribeReadAck = socketService.onConversationReadAck((payload) => {
      const currentUserId = useAuthStore.getState().user?.id;
      set((state) => {
        const nextCounts = {
          ...state.unreadCountsByConversation,
          [payload.conversationId]: 0,
        };
        const nextUsers = new Set(state.unreadUserIds);
        const nextGroups = new Set(state.unreadGroupIds);

        if (payload.conversationId.startsWith('direct:') && currentUserId) {
          const parts = payload.conversationId.slice(7).split(':');
          const partner = parts.find((id) => id !== currentUserId);
          if (partner) nextUsers.delete(partner);
        } else if (payload.conversationId.startsWith('group:')) {
          nextGroups.delete(payload.conversationId.slice(6));
        }

        return {
          unreadCountsByConversation: nextCounts,
          unreadUserIds: nextUsers,
          unreadGroupIds: nextGroups,
        };
      });
    });

    unsubscribeMessageDelivered = socketService.onMessageDelivered((payload) => {
      set((state) => ({
        messages: state.messages.map((msg) => {
          if (
            msg.id === payload.messageId &&
            (msg.status === 'sent' || msg.status === 'sending' || !msg.status)
          ) {
            return { ...msg, status: 'delivered' };
          }
          return msg;
        }),
      }));
    });

    unsubscribeMessagesRead = socketService.onMessagesRead((payload) => {
      const myId = useAuthStore.getState().user?.id;
      const currentConvo = get().activeConversation;
      const expectedConvoId = currentConvo
        ? currentConvo.type === 'direct'
          ? myId
            ? getDirectConversationId(myId, currentConvo.id)
            : `direct:${currentConvo.id}`
          : getGroupConversationId(currentConvo.id)
        : null;

      set((state) => ({
        partnerLastReadMessageId: payload.lastReadMessageId,
        messages: state.messages.map((msg) => {
          if (
            (!msg.conversationId ||
              msg.conversationId === payload.conversationId ||
              msg.conversationId === expectedConvoId) &&
            msg.senderId === myId &&
            payload.lastReadMessageId &&
            msg.id <= payload.lastReadMessageId
          ) {
            return { ...msg, status: 'read' };
          }
          return msg;
        }),
      }));
    });

    unsubscribeGroupMessagesRead = socketService.onGroupMessagesRead((payload) => {
      const myId = useAuthStore.getState().user?.id;
      const activeConvo = get().activeConversation;
      if (!activeConvo || activeConvo.type !== 'group' || activeConvo.id !== payload.groupId) {
        return;
      }

      set((state) => {
        const updatedGroupReadMap = {
          ...state.groupMemberLastReadMap,
          [payload.readerId]: payload.lastReadMessageId,
        };

        const activeGroup = activeConvo.group;
        const allMemberIds =
          activeGroup?.members?.map((m) => m.userId) || Object.keys(updatedGroupReadMap);
        const otherMemberIds = allMemberIds.filter((id) => id !== myId);

        return {
          groupMemberLastReadMap: updatedGroupReadMap,
          messages: state.messages.map((msg) => {
            if (msg.senderId === myId && msg.status !== 'read') {
              const allRead =
                otherMemberIds.length > 0 &&
                otherMemberIds.every((id) => {
                  const memberWatermark = updatedGroupReadMap[id];
                  return memberWatermark && msg.id <= memberWatermark;
                });

              if (allRead) {
                return { ...msg, status: 'read' };
              }
            }
            return msg;
          }),
        };
      });
    });

    unsubscribeDoubtStatus = socketService.onDoubtStatusChanged((payload) => {
      set((state) => ({
        messages: state.messages.map((msg) => {
          if (msg.id === payload.messageId) {
            return {
              ...msg,
              doubtStatus: payload.status,
              resolvedBy: payload.resolvedBy,
              resolvedByName: payload.resolvedByName,
              resolvedAt: payload.resolvedAt,
            };
          }
          return msg;
        }),
      }));
    });

    unsubscribeMessagePinned = socketService.onMessagePinned((payload) => {
      const currentConvo = get().activeConversation;
      if (!currentConvo) return;
      const currentUserId = useAuthStore.getState().user?.id;
      const activeConvoId =
        currentConvo.type === 'direct'
          ? currentUserId
            ? getDirectConversationId(currentUserId, currentConvo.id)
            : `direct:${currentConvo.id}`
          : getGroupConversationId(currentConvo.id);

      if (payload.conversationId === activeConvoId) {
        set((state) => {
          const existingFiltered = state.pinnedMessages.filter(
            (p) => p.messageId !== payload.pin.messageId,
          );
          const updated = [payload.pin, ...existingFiltered].slice(0, 5);
          return { pinnedMessages: updated, activePinIndex: 0 };
        });
      }
    });

    unsubscribeMessageUnpinned = socketService.onMessageUnpinned((payload) => {
      const currentConvo = get().activeConversation;
      if (!currentConvo) return;
      const currentUserId = useAuthStore.getState().user?.id;
      const activeConvoId =
        currentConvo.type === 'direct'
          ? currentUserId
            ? getDirectConversationId(currentUserId, currentConvo.id)
            : `direct:${currentConvo.id}`
          : getGroupConversationId(currentConvo.id);

      if (payload.conversationId === activeConvoId) {
        set((state) => {
          const updated = state.pinnedMessages.filter(
            (p) => p.messageId !== payload.messageId,
          );
          const nextIndex = Math.min(state.activePinIndex, Math.max(0, updated.length - 1));
          return { pinnedMessages: updated, activePinIndex: nextIndex };
        });
      }
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
