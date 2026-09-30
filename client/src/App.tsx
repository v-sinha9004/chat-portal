import { useState, useEffect, useCallback } from 'react';
import type { User, Group, ActiveConversation } from './types';
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

function MainChatPortal() {
  const { user, accessToken, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [dataFetchError, setDataFetchError] = useState<string | null>(null);

  // Active selected conversation (direct contact or group)
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);

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

  // 2. Connect socket with signed JWT and listen for unread notifications
  useEffect(() => {
    if (!isAuthenticated || !accessToken || !currentUserId) {
      socketService.disconnect();
      setIsSocketConnected(false);
      return;
    }

    // Connect with JWT access token
    socketService.connect(accessToken, currentUserId);
    const unsubscribeConn = socketService.onConnectionChange(setIsSocketConnected);

    // Direct Message Listener for unread badges
    const handleIncomingDirect = (payload: IncomingDirectMessageEvent) => {
      const partnerId = payload.senderId;
      setActiveConversation((current) => {
        if (!current || current.type !== 'direct' || current.id !== partnerId) {
          setUnreadUserIds((prev) => new Set(prev).add(partnerId));
        }
        return current;
      });
    };

    // Group Message Listener for unread badges
    const handleIncomingGroup = (payload: IncomingGroupMessageEvent) => {
      const { groupId } = payload;
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
        key={activeConversation ? `${activeConversation.type}:${activeConversation.id}` : 'empty'}
        activeConversation={activeConversation}
        users={users}
        currentUserId={currentUserId}
        accessToken={accessToken}
        isLoadingInitial={isLoadingData}
        errorInitial={dataFetchError}
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
