import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { UserList } from './components/UserList';
import { ChatArea } from './components/ChatArea';
import { CreateGroupModal } from './components/CreateGroupModal';
import { useChatStore } from './store/useChatStore';
import './App.css';

function MainChatPortal() {
  const { user, accessToken, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();

  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const initSocket = useChatStore((s) => s.initSocket);
  const reset = useChatStore((s) => s.reset);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !user?.id) {
      reset();
      return;
    }

    fetchConversations(accessToken, user.id, logout);
    initSocket(accessToken, user.id);

    return () => {
      reset();
    };
  }, [isAuthenticated, accessToken, user?.id, fetchConversations, initSocket, reset, logout]);

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

  return (
    <div className="chat-app-container">
      <UserList />
      <ChatArea />
      <CreateGroupModal />
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
