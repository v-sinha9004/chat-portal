import { useEffect } from 'react';
import { useAuthStore, useConversationState, useChatActions, useUIStore } from '@/store';
import {
  AuthView,
  Sidebar,
  ChatArea,
  ReportedMessagesArea,
  CreateGroupModal,
  GroupModal,
  ToastContainer,
} from '@/components';
import './App.css';

function App() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const hydrateSession = useAuthStore((s) => s.hydrateSession);

  const activeView = useUIStore((s) => s.activeView);
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const showReports = activeView === 'reports' && isAdmin;

  const { activeConversation } = useConversationState();
  const { fetchConversations, initSocket, reset: resetChat } = useChatActions();

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

  const hasActiveScreen = Boolean(activeConversation || showReports);

  return (
    <>
      <div className={`chat-app-container ${hasActiveScreen ? 'has-active-chat' : 'no-active-chat'}`}>
        <Sidebar />
        {showReports ? <ReportedMessagesArea /> : <ChatArea />}
        <CreateGroupModal />
        <GroupModal />
      </div>
      <ToastContainer />
    </>
  );
}



export default App;
