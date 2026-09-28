import { useState } from 'react';
import type { User, ChatMessage } from './types';
import { dummyUsersResponse, initialMessages } from './mockData';
import { UserList } from './components/UserList';
import { ChatArea } from './components/ChatArea';
import './App.css';

function App() {
  const users: User[] = dummyUsersResponse.data;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    users[0]?.id ?? null
  );
  const [messagesByUser, setMessagesByUser] = useState<Record<string, ChatMessage[]>>(initialMessages);

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
      />
      <ChatArea
        selectedUser={selectedUser}
        messages={currentMessages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}

export default App;
