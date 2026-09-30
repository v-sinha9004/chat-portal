import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import { AuthView } from './components/auth/AuthView';
import { UserList } from './components/UserList';
import { ChatArea } from './components/ChatArea';
import { CreateGroupModal } from './components/CreateGroupModal';
import './App.css';

function App() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const hydrateSession = useAuthStore((s) => s.hydrateSession);

  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const initSocket = useChatStore((s) => s.initSocket);
  const resetChat = useChatStore((s) => s.reset);

  // Hydrate session from HttpOnly cookie on initial mount
  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  // Connect socket and fetch conversations once authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchConversations();
      initSocket();

      return () => {
        resetChat();
      };
    }
  }, [isAuthenticated, user?.id, fetchConversations, initSocket, resetChat]);

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

export default App;
