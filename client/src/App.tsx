import { useState, useEffect, useCallback } from 'react';
import type { User, ChatMessage } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { fetchUsers } from './services/userService';
import { socketService, type IncomingDirectMessageEvent } from './services/socketService';
import { UserList } from './components/UserList';
import { ChatArea } from './components/ChatArea';
import './App.css';

function MainChatPortal() {
  const { user, accessToken, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [userFetchError, setUserFetchError] = useState<string | null>(null);

  // Selected chat partner
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // In-memory conversation messages: { [contactUserId]: ChatMessage[] }
  const [messagesByUser, setMessagesByUser] = useState<Record<string, ChatMessage[]>>({});

  // Socket connection state
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);

  // Unread contact IDs
  const [unreadUserIds, setUnreadUserIds] = useState<Set<string>>(new Set());

  const [reloadKey, setReloadKey] = useState<number>(0);

  const currentUserId = user?.id || null;

  // Fetch users from user-service via API Gateway (passing Bearer token)
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    let ignore = false;
    const controller = new AbortController();

    async function loadContacts() {
      setIsLoadingUsers(true);
      try {
        const data = await fetchUsers(accessToken, controller.signal);
        if (!ignore) {
          setUsers(data);
          setUserFetchError(null);

          // Auto-select first contact that is not the current user
          setSelectedUserId((currentSelected) => {
            if (currentSelected && data.some((u) => u.id === currentSelected && u.id !== currentUserId)) {
              return currentSelected;
            }
            const firstOther = data.find((u) => u.id !== currentUserId);
            return firstOther?.id || null;
          });
        }
      } catch (err: unknown) {
        if (!ignore) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          const message = err instanceof Error ? err.message : 'Failed to fetch contacts';
          if (message.includes('Unauthorized')) {
            logout();
            return;
          }
          setUserFetchError(message);
        }
      } finally {
        if (!ignore) {
          setIsLoadingUsers(false);
        }
      }
    }

    loadContacts();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [isAuthenticated, accessToken, currentUserId, reloadKey, logout]);

  // Connect socket with signed JWT access token and handle real-time events
  useEffect(() => {
    if (!isAuthenticated || !accessToken || !currentUserId) {
      socketService.disconnect();
      setIsSocketConnected(false);
      return;
    }

    // Connect passing the real JWT access token
    socketService.connect(accessToken, currentUserId);
    const unsubscribeConn = socketService.onConnectionChange(setIsSocketConnected);

    const handleIncomingMessage = (payload: IncomingDirectMessageEvent) => {
      const partnerId = payload.senderId;
      const formattedTime = new Date(payload.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const incomingMsg: ChatMessage = {
        id: payload.id,
        clientMessageId: payload.clientMessageId,
        senderId: payload.senderId,
        receiverId: payload.recipientId,
        text: payload.data?.message || '',
        timestamp: formattedTime,
        status: 'sent',
      };

      setMessagesByUser((prev) => {
        const existing = prev[partnerId] || [];
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
          [partnerId]: [...existing, incomingMsg],
        };
      });

      // Mark unread if not currently viewing that user's chat
      setSelectedUserId((currentSelected) => {
        if (currentSelected !== partnerId) {
          setUnreadUserIds((prev) => new Set(prev).add(partnerId));
        }
        return currentSelected;
      });
    };

    const unsubscribeMsg = socketService.onDirectMessage(handleIncomingMessage);

    return () => {
      unsubscribeConn();
      unsubscribeMsg();
      socketService.disconnect();
    };
  }, [isAuthenticated, accessToken, currentUserId]);

  const handleRetry = () => {
    setIsLoadingUsers(true);
    setUserFetchError(null);
    setReloadKey((prev) => prev + 1);
  };

  const handleSelectUser = useCallback((selected: User) => {
    setSelectedUserId(selected.id);
    setUnreadUserIds((prev) => {
      if (prev.has(selected.id)) {
        const next = new Set(prev);
        next.delete(selected.id);
        return next;
      }
      return prev;
    });
  }, []);

  const handleSendMessage = async (text: string) => {
    if (!selectedUserId || !currentUserId) return;

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const optimisticMessage: ChatMessage = {
      id: clientMessageId,
      clientMessageId,
      senderId: currentUserId,
      receiverId: selectedUserId,
      text,
      timestamp: formattedTime,
      status: 'sending',
    };

    // Optimistically render outgoing message
    setMessagesByUser((prev) => ({
      ...prev,
      [selectedUserId]: [...(prev[selectedUserId] || []), optimisticMessage],
    }));

    try {
      const ack = await socketService.sendMessage(selectedUserId, text, clientMessageId);
      setMessagesByUser((prev) => {
        const list = prev[selectedUserId] || [];
        return {
          ...prev,
          [selectedUserId]: list.map((msg) =>
            msg.clientMessageId === clientMessageId
              ? { ...msg, id: ack.messageId || msg.id, status: 'sent' }
              : msg,
          ),
        };
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessagesByUser((prev) => {
        const list = prev[selectedUserId] || [];
        return {
          ...prev,
          [selectedUserId]: list.map((msg) =>
            msg.clientMessageId === clientMessageId ? { ...msg, status: 'failed' } : msg,
          ),
        };
      });
    }
  };

  // 1. Initial Authentication Boot Check
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

  // 2. Unauthenticated View (Login / Register)
  if (!isAuthenticated || !user) {
    return <AuthView />;
  }

  // 3. Authenticated View (Main Chat Application)
  const selectedUser = users.find((u) => u.id === selectedUserId) || null;
  const currentMessages = selectedUserId ? messagesByUser[selectedUserId] || [] : [];

  return (
    <div className="chat-app-container">
      <UserList
        users={users}
        currentUserId={currentUserId}
        currentUser={user}
        onLogout={logout}
        selectedUserId={selectedUserId}
        onSelectUser={handleSelectUser}
        isLoading={isLoadingUsers}
        error={userFetchError}
        onRetry={handleRetry}
        isSocketConnected={isSocketConnected}
        unreadUserIds={unreadUserIds}
      />
      <ChatArea
        selectedUser={selectedUser}
        currentUserId={currentUserId}
        messages={currentMessages}
        onSendMessage={handleSendMessage}
        isLoading={isLoadingUsers}
        error={userFetchError}
        isSocketConnected={isSocketConnected}
      />
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
