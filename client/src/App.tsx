import { useState, useEffect, useCallback } from 'react';
import type { User, ChatMessage } from './types';
import { fetchUsers } from './services/userService';
import { socketService, type IncomingDirectMessageEvent } from './services/socketService';
import { UserList } from './components/UserList';
import { ChatArea } from './components/ChatArea';
import './App.css';

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active identity ("Who am I")
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return sessionStorage.getItem('chat_portal_user_id') || null;
  });

  // Selected chat partner
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // In-memory conversation messages: { [contactUserId]: ChatMessage[] }
  const [messagesByUser, setMessagesByUser] = useState<Record<string, ChatMessage[]>>({});

  // Socket connection state
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);

  // Unread contact IDs
  const [unreadUserIds, setUnreadUserIds] = useState<Set<string>>(new Set());

  const [reloadKey, setReloadKey] = useState<number>(0);

  // Fetch users from user-service
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function loadUsers() {
      try {
        const data = await fetchUsers(controller.signal);
        if (!ignore) {
          setUsers(data);
          setError(null);

          // Establish initial current user and contact
          if (data.length > 0) {
            const savedUserId = sessionStorage.getItem('chat_portal_user_id');
            const validCurrentUser = data.find((u) => u.id === savedUserId);
            const activeId = validCurrentUser ? validCurrentUser.id : data[0].id;

            setCurrentUserId(activeId);
            sessionStorage.setItem('chat_portal_user_id', activeId);

            // Select first available contact (different from current user)
            const firstContact = data.find((u) => u.id !== activeId);
            setSelectedUserId(firstContact?.id || null);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          const message = err instanceof Error ? err.message : 'Failed to fetch users';
          setError(message);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [reloadKey]);

  // Connect socket and handle incoming messages when currentUserId changes
  useEffect(() => {
    if (!currentUserId) return;

    socketService.connect(currentUserId);
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
        // Avoid duplicate insertion
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

      // Show unread indicator if the incoming message is not from the currently selected chat
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
  }, [currentUserId]);

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    setReloadKey((prev) => prev + 1);
  };

  const handleSwitchCurrentUser = (newUserId: string) => {
    setCurrentUserId(newUserId);
    sessionStorage.setItem('chat_portal_user_id', newUserId);

    // Pick first contact that is not the new current user
    const otherContacts = users.filter((u) => u.id !== newUserId);
    setSelectedUserId(otherContacts[0]?.id || null);
  };

  const handleSelectUser = useCallback((user: User) => {
    setSelectedUserId(user.id);
    setUnreadUserIds((prev) => {
      if (prev.has(user.id)) {
        const next = new Set(prev);
        next.delete(user.id);
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

    // Optimistically render message
    setMessagesByUser((prev) => ({
      ...prev,
      [selectedUserId]: [...(prev[selectedUserId] || []), optimisticMessage],
    }));

    try {
      const ack = await socketService.sendMessage(selectedUserId, text, clientMessageId);
      // Reconcile optimistic message with server-assigned UUID and mark sent
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

  const selectedUser = users.find((u) => u.id === selectedUserId) || null;
  const currentMessages = selectedUserId ? messagesByUser[selectedUserId] || [] : [];

  return (
    <div className="chat-app-container">
      <UserList
        users={users}
        currentUserId={currentUserId}
        onSwitchCurrentUser={handleSwitchCurrentUser}
        selectedUserId={selectedUserId}
        onSelectUser={handleSelectUser}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        isSocketConnected={isSocketConnected}
        unreadUserIds={unreadUserIds}
      />
      <ChatArea
        selectedUser={selectedUser}
        currentUserId={currentUserId}
        messages={currentMessages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        error={error}
        isSocketConnected={isSocketConnected}
      />
    </div>
  );
}

export default App;
