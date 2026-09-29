import { useState, useEffect, useCallback } from 'react';
import type { User, Group, ChatMessage, ActiveConversation } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { fetchUsers } from './services/userService';
import { fetchUserGroups } from './services/groupService';
import {
  socketService,
  type IncomingDirectMessageEvent,
  type IncomingGroupMessageEvent,
} from './services/socketService';
import { UserList } from './components/UserList';
import { ChatArea } from './components/ChatArea';
import { CreateGroupModal } from './components/CreateGroupModal';
import './App.css';

const getDirectConvoKey = (u1: string, u2: string) => `direct:${[u1, u2].sort().join(':')}`;
const getGroupConvoKey = (groupId: string) => `group:${groupId}`;

const sortMessages = (list: ChatMessage[]) => {
  return [...list].sort((a, b) => {
    if (a.id.startsWith('client-') && !b.id.startsWith('client-')) return 1;
    if (!a.id.startsWith('client-') && b.id.startsWith('client-')) return -1;
    return a.id.localeCompare(b.id);
  });
};

function MainChatPortal() {
  const { user, accessToken, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [dataFetchError, setDataFetchError] = useState<string | null>(null);

  // Active selected conversation (direct contact or group)
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);

  // In-memory conversation messages: { [conversationKey]: ChatMessage[] }
  // Key format: "direct:<userId>" or "group:<groupId>"
  const [messagesByConvo, setMessagesByConvo] = useState<Record<string, ChatMessage[]>>({});

  // Socket connection state
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);

  // Unread conversation IDs
  const [unreadUserIds, setUnreadUserIds] = useState<Set<string>>(new Set());
  const [unreadGroupIds, setUnreadGroupIds] = useState<Set<string>>(new Set());

  // Create Group Modal visibility
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState<boolean>(false);

  const [reloadKey, setReloadKey] = useState<number>(0);

  const currentUserId = user?.id || null;

  // 1. Fetch contacts and user groups concurrently
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    const token = accessToken;
    let ignore = false;
    const controller = new AbortController();

    async function loadConversations() {
      setIsLoadingData(true);
      try {
        const [fetchedUsers, fetchedGroups] = await Promise.all([
          fetchUsers(token, controller.signal),
          fetchUserGroups(token, controller.signal).catch((err) => {
            console.error('Failed to fetch user groups:', err);
            return [] as Group[];
          }),
        ]);


        if (!ignore) {
          setUsers(fetchedUsers);
          setGroups(fetchedGroups);
          setDataFetchError(null);

          // Auto-select first available conversation if none active
          setActiveConversation((current) => {
            if (current) {
              if (current.type === 'direct' && fetchedUsers.some((u) => u.id === current.id)) {
                return current;
              }
              if (current.type === 'group' && fetchedGroups.some((g) => g.id === current.id)) {
                return current;
              }
            }

            // Priority: select first direct contact, or first group
            const firstOther = fetchedUsers.find((u) => u.id !== currentUserId);
            if (firstOther) {
              return { type: 'direct', id: firstOther.id, user: firstOther };
            }
            if (fetchedGroups.length > 0) {
              return { type: 'group', id: fetchedGroups[0].id, group: fetchedGroups[0] };
            }
            return null;
          });
        }
      } catch (err: unknown) {
        if (!ignore) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          const message = err instanceof Error ? err.message : 'Failed to fetch conversations';
          if (message.includes('Unauthorized')) {
            logout();
            return;
          }
          setDataFetchError(message);
        }
      } finally {
        if (!ignore) {
          setIsLoadingData(false);
        }
      }
    }

    loadConversations();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [isAuthenticated, accessToken, currentUserId, reloadKey, logout]);

  // 2. Connect socket with signed JWT and listen for direct + group events
  useEffect(() => {
    if (!isAuthenticated || !accessToken || !currentUserId) {
      socketService.disconnect();
      setIsSocketConnected(false);
      return;
    }

    // Connect with JWT access token
    socketService.connect(accessToken, currentUserId);
    const unsubscribeConn = socketService.onConnectionChange(setIsSocketConnected);

    // Direct Message Listener
    const handleIncomingDirect = (payload: IncomingDirectMessageEvent) => {
      const partnerId = payload.senderId;
      const formattedTime = new Date(payload.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const convoKey =
        payload.conversationId ||
        getDirectConvoKey(payload.senderId, payload.recipientId);

      const incomingMsg: ChatMessage = {
        id: payload.id,
        conversationId: convoKey,
        clientMessageId: payload.clientMessageId,
        senderId: payload.senderId,
        receiverId: payload.recipientId,
        text: payload.data?.message || '',
        timestamp: formattedTime,
        status: 'sent',
      };

      setMessagesByConvo((prev) => {
        const existing = prev[convoKey] || [];
        if (
          existing.some(
            (m) =>
              m.id === incomingMsg.id ||
              (incomingMsg.clientMessageId && m.clientMessageId === incomingMsg.clientMessageId),
          )
        ) {
          return prev;
        }
        return {
          ...prev,
          [convoKey]: sortMessages([...existing, incomingMsg]),
        };
      });

      // Mark unread if not currently viewing this direct chat
      setActiveConversation((current) => {
        if (!current || current.type !== 'direct' || current.id !== partnerId) {
          setUnreadUserIds((prev) => new Set(prev).add(partnerId));
        }
        return current;
      });
    };

    // Group Message Listener
    const handleIncomingGroup = (payload: IncomingGroupMessageEvent) => {
      const { groupId } = payload;
      const formattedTime = new Date(payload.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const convoKey = payload.conversationId || getGroupConvoKey(groupId);

      const incomingMsg: ChatMessage = {
        id: payload.id,
        conversationId: convoKey,
        clientMessageId: payload.clientMessageId,
        senderId: payload.senderId,
        groupId,
        text: payload.data?.message || '',
        timestamp: formattedTime,
        status: 'sent',
      };

      setMessagesByConvo((prev) => {
        const existing = prev[convoKey] || [];
        if (
          existing.some(
            (m) =>
              m.id === incomingMsg.id ||
              (incomingMsg.clientMessageId && m.clientMessageId === incomingMsg.clientMessageId),
          )
        ) {
          return prev;
        }
        return {
          ...prev,
          [convoKey]: sortMessages([...existing, incomingMsg]),
        };
      });

      // Mark unread if not currently viewing this group
      setActiveConversation((current) => {
        if (!current || current.type !== 'group' || current.id !== groupId) {
          setUnreadGroupIds((prev) => new Set(prev).add(groupId));
        }
        return current;
      });
    };

    const unsubscribeDirect = socketService.onDirectMessage(handleIncomingDirect);
    const unsubscribeGroup = socketService.onGroupMessage(handleIncomingGroup);

    return () => {
      unsubscribeConn();
      unsubscribeDirect();
      unsubscribeGroup();
      socketService.disconnect();
    };
  }, [isAuthenticated, accessToken, currentUserId]);

  const handleRetry = () => {
    setIsLoadingData(true);
    setDataFetchError(null);
    setReloadKey((prev) => prev + 1);
  };

  const handleSelectConversation = useCallback((convo: ActiveConversation) => {
    setActiveConversation(convo);

    if (convo.type === 'direct') {
      setUnreadUserIds((prev) => {
        if (prev.has(convo.id)) {
          const next = new Set(prev);
          next.delete(convo.id);
          return next;
        }
        return prev;
      });
    } else {
      setUnreadGroupIds((prev) => {
        if (prev.has(convo.id)) {
          const next = new Set(prev);
          next.delete(convo.id);
          return next;
        }
        return prev;
      });
    }
  }, []);

  const handleSendMessage = async (text: string) => {
    if (!activeConversation || !currentUserId) return;

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isGroup = activeConversation.type === 'group';
    const convoKey = isGroup
      ? getGroupConvoKey(activeConversation.id)
      : getDirectConvoKey(currentUserId, activeConversation.id);

    const optimisticMessage: ChatMessage = {
      id: clientMessageId,
      conversationId: convoKey,
      clientMessageId,
      senderId: currentUserId,
      receiverId: !isGroup ? activeConversation.id : undefined,
      groupId: isGroup ? activeConversation.id : undefined,
      text,
      timestamp: formattedTime,
      status: 'sending',
    };

    // Optimistically render outgoing message
    setMessagesByConvo((prev) => ({
      ...prev,
      [convoKey]: sortMessages([...(prev[convoKey] || []), optimisticMessage]),
    }));

    try {
      if (isGroup) {
        const ack = await socketService.sendGroupMessage(
          activeConversation.id,
          text,
          clientMessageId,
        );
        setMessagesByConvo((prev) => {
          const list = prev[convoKey] || [];
          return {
            ...prev,
            [convoKey]: sortMessages(
              list.map((msg) =>
                msg.clientMessageId === clientMessageId
                  ? {
                      ...msg,
                      id: ack.messageId || msg.id,
                      conversationId: ack.conversationId || convoKey,
                      status: 'sent',
                    }
                  : msg,
              ),
            ),
          };
        });
      } else {
        const ack = await socketService.sendMessage(activeConversation.id, text, clientMessageId);
        setMessagesByConvo((prev) => {
          const list = prev[convoKey] || [];
          return {
            ...prev,
            [convoKey]: sortMessages(
              list.map((msg) =>
                msg.clientMessageId === clientMessageId
                  ? {
                      ...msg,
                      id: ack.messageId || msg.id,
                      conversationId: ack.conversationId || convoKey,
                      status: 'sent',
                    }
                  : msg,
              ),
            ),
          };
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessagesByConvo((prev) => {
        const list = prev[convoKey] || [];
        return {
          ...prev,
          [convoKey]: list.map((msg) =>
            msg.clientMessageId === clientMessageId ? { ...msg, status: 'failed' } : msg,
          ),
        };
      });
    }
  };

  const handleGroupCreated = (newGroup: Group) => {
    setGroups((prev) => [newGroup, ...prev]);
    setActiveConversation({ type: 'group', id: newGroup.id, group: newGroup });
  };

  // Boot Loader
  if (isAuthLoading) {
    return (
      <div className="app-boot-loader">
        <div className="app-boot-brand">
          <span className="app-boot-icon">💬</span>
          <span className="app-boot-title">Chat Portal</span>
        </div>
        <div className="loading-spinner large" />
      </div>
    );
  }

  // Unauthenticated View
  if (!isAuthenticated || !user) {
    return <AuthView />;
  }

  // Active messages list
  const currentConvoKey = activeConversation
    ? activeConversation.type === 'group'
      ? getGroupConvoKey(activeConversation.id)
      : currentUserId
      ? getDirectConvoKey(currentUserId, activeConversation.id)
      : null
    : null;
  const currentMessages = currentConvoKey ? messagesByConvo[currentConvoKey] || [] : [];
  const contacts = users.filter((u) => u.id !== currentUserId);

  return (
    <div className="chat-app-container">
      <UserList
        users={users}
        groups={groups}
        currentUserId={currentUserId}
        currentUser={user}
        onLogout={logout}
        activeConversation={activeConversation}
        onSelectConversation={handleSelectConversation}
        onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
        isLoading={isLoadingData}
        error={dataFetchError}
        onRetry={handleRetry}
        isSocketConnected={isSocketConnected}
        unreadUserIds={unreadUserIds}
        unreadGroupIds={unreadGroupIds}
      />

      <ChatArea
        activeConversation={activeConversation}
        users={users}
        currentUserId={currentUserId}
        messages={currentMessages}
        onSendMessage={handleSendMessage}
        isLoading={isLoadingData}
        error={dataFetchError}
        isSocketConnected={isSocketConnected}
      />

      {accessToken && currentUserId && (
        <CreateGroupModal
          isOpen={isCreateGroupOpen}
          onClose={() => setIsCreateGroupOpen(false)}
          contacts={contacts}
          currentUserId={currentUserId}
          token={accessToken}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainChatPortal />
    </AuthProvider>
  );
}

export default App;
