import { useState, useEffect } from 'react';
import type { User, ChatMessage } from './types';
import { initialMessages } from './mockData';
import { fetchUsers } from './services/userService';
import { UserList } from './components/UserList';
import { ChatArea } from './components/ChatArea';
import './App.css';

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messagesByUser, setMessagesByUser] = useState<Record<string, ChatMessage[]>>(initialMessages);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function loadUsers() {
      try {
        const data = await fetchUsers(controller.signal);
        if (!ignore) {
          setUsers(data);
          setSelectedUserId((prev) => {
            if (prev && data.some((u) => u.id === prev)) {
              return prev;
            }
            return data[0]?.id ?? null;
          });
          setError(null);
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

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    setReloadKey((prev) => prev + 1);
  };

  const selectedUser = users.find((u) => u.id === selectedUserId) || null;
  const currentMessages = selectedUserId ? messagesByUser[selectedUserId] || [] : [];

  const handleSelectUser = (user: User) => {
    setSelectedUserId(user.id);
  };

  const handleSendMessage = (text: string) => {
    if (!selectedUserId) return;

    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: 'current-user',
      receiverId: selectedUserId,
      text,
      timestamp: formattedTime,
    };

    setMessagesByUser((prev) => ({
      ...prev,
      [selectedUserId]: [...(prev[selectedUserId] || []), newMessage],
    }));
  };

  return (
    <div className="chat-app-container">
      <UserList
        users={users}
        selectedUserId={selectedUserId}
        onSelectUser={handleSelectUser}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
      />
      <ChatArea
        selectedUser={selectedUser}
        messages={currentMessages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

export default App;
