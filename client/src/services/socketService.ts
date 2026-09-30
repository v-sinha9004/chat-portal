import { io, Socket } from 'socket.io-client';
import type {
  UserPresence,
  GroupPresence,
  UserPresenceChangedEvent,
  GroupPresenceChangedEvent,
} from '../types';

export interface IncomingDirectMessageEvent {
  id: string;
  conversationId?: string;
  senderId: string;
  recipientId: string;
  data: {
    message: string;
    [key: string]: unknown;
  };
  timestamp: string;
  clientMessageId?: string;
}

export interface SendMessageAck {
  status: 'ok' | 'error';
  messageId?: string;
  conversationId?: string;
  clientMessageId?: string;
  message?: string;
  data?: IncomingDirectMessageEvent;
}

export interface IncomingGroupMessageEvent {
  id: string;
  conversationId?: string;
  groupId: string;
  senderId: string;
  data: {
    message: string;
    [key: string]: unknown;
  };
  timestamp: string;
  clientMessageId?: string;
}

export interface SendGroupMessageAck {
  status: 'ok' | 'error';
  messageId?: string;
  conversationId?: string;
  clientMessageId?: string;
  groupId?: string;
  message?: string;
  data?: IncomingGroupMessageEvent;
}

type MessageListener = (event: IncomingDirectMessageEvent) => void;
type GroupMessageListener = (event: IncomingGroupMessageEvent) => void;
type UserPresenceListener = (event: UserPresenceChangedEvent) => void;
type GroupPresenceListener = (event: GroupPresenceChangedEvent) => void;
type ConnectionListener = (connected: boolean) => void;

class SocketService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;
  private currentUserId: string | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private groupMessageListeners: Set<GroupMessageListener> = new Set();
  private userPresenceListeners: Set<UserPresenceListener> = new Set();
  private groupPresenceListeners: Set<GroupPresenceListener> = new Set();
  private connectionListeners: Set<ConnectionListener> = new Set();


  private getSocketUrl(): string {
    return import.meta.env.VITE_CHAT_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  }

  /**
   * Connect to the Socket.IO server with a signed JWT access token.
   * If already connected with the same token, does nothing.
   * If connected with a different token/user, disconnects and reconnects.
   */
  connect(token: string, userId?: string): Socket {
    if (this.socket && this.currentToken === token && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.disconnect();
    }

    this.currentToken = token;
    this.currentUserId = userId || null;
    const socketUrl = this.getSocketUrl();

    this.socket = io(socketUrl, {
      auth: { token, userId },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.notifyConnectionChange(true);
    });

    this.socket.on('disconnect', () => {
      this.notifyConnectionChange(false);
    });

    this.socket.on('connect_error', () => {
      this.notifyConnectionChange(false);
    });

    this.socket.on('direct_message', (payload: IncomingDirectMessageEvent) => {
      this.messageListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error('Error in direct_message listener:', err);
        }
      });
    });

    this.socket.on('group_message', (payload: IncomingGroupMessageEvent) => {
      this.groupMessageListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error('Error in group_message listener:', err);
        }
      });
    });

    this.socket.on('user_presence_changed', (payload: UserPresenceChangedEvent) => {
      this.userPresenceListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error('Error in user_presence_changed listener:', err);
        }
      });
    });

    this.socket.on('group_presence_changed', (payload: GroupPresenceChangedEvent) => {
      this.groupPresenceListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error('Error in group_presence_changed listener:', err);
        }
      });
    });

    return this.socket;
  }

  /**
   * Disconnects the socket and clears the active user.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.currentToken = null;
      this.currentUserId = null;
      this.notifyConnectionChange(false);
    }
  }

  /**
   * Send a direct message to a recipient.
   */
  sendMessage(
    recipientId: string,
    message: string,
    clientMessageId?: string,
  ): Promise<SendMessageAck> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Socket is not connected. Please connect first.'));
      }

      this.socket.emit(
        'send_direct_message',
        { recipientId, message, clientMessageId },
        (ack: SendMessageAck) => {
          if (!ack) {
            return reject(new Error('No acknowledgement received from chat server'));
          }
          if (ack.status === 'error') {
            return reject(new Error(ack.message || 'Failed to dispatch message'));
          }
          resolve(ack);
        },
      );
    });
  }

  /**
   * Send a group message to a group.
   */
  sendGroupMessage(
    groupId: string,
    message: string,
    clientMessageId?: string,
  ): Promise<SendGroupMessageAck> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Socket is not connected. Please connect first.'));
      }

      this.socket.emit(
        'send_group_message',
        { groupId, message, clientMessageId },
        (ack: SendGroupMessageAck) => {
          if (!ack) {
            return reject(new Error('No acknowledgement received from chat server'));
          }
          if (ack.status === 'error') {
            return reject(new Error(ack.message || 'Failed to dispatch group message'));
          }
          resolve(ack);
        },
      );
    });
  }

  /**
   * Register a listener for incoming messages.
   * Returns an unregister cleanup function.
   */
  onDirectMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  /**
   * Register a listener for incoming group messages.
   * Returns an unregister cleanup function.
   */
  onGroupMessage(listener: GroupMessageListener): () => void {
    this.groupMessageListeners.add(listener);
    return () => {
      this.groupMessageListeners.delete(listener);
    };
  }


  private notifyConnectionChange(connected: boolean): void {
    this.connectionListeners.forEach((listener) => {
      try {
        listener(connected);
      } catch (err) {
        console.error('Error in connection listener:', err);
      }
    });
  }

  /**
   * Register a listener for connection status changes.
   * Immediately calls the listener with the current connection status.
   */
  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.isConnected());
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  /**
   * Current connection status.
   */
  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  /**
   * Current connected user ID.
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Subscribe to on-demand presence for a direct chat user.
   */
  subscribeUserPresence(targetUserId: string): Promise<UserPresence> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Socket is not connected.'));
      }
      this.socket.emit(
        'subscribe_user_presence',
        { targetUserId },
        (ack: {
          status: string;
          userId: string;
          isOnline: boolean;
          lastSeen: string | null;
          message?: string;
        }) => {
          if (!ack || ack.status === 'error') {
            return reject(new Error(ack?.message || 'Failed to subscribe to user presence'));
          }
          resolve({
            userId: ack.userId,
            isOnline: ack.isOnline,
            lastSeen: ack.lastSeen,
          });
        },
      );
    });
  }

  /**
   * Unsubscribe from presence for a direct chat user.
   */
  unsubscribeUserPresence(targetUserId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe_user_presence', { targetUserId });
    }
  }

  /**
   * Subscribe to on-demand presence for a group.
   */
  subscribeGroupPresence(groupId: string): Promise<GroupPresence> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Socket is not connected.'));
      }
      this.socket.emit(
        'subscribe_group_presence',
        { groupId },
        (ack: {
          status: string;
          groupId: string;
          totalMembers: number;
          onlineCount: number;
          onlineMemberIds: string[];
          message?: string;
        }) => {
          if (!ack || ack.status === 'error') {
            return reject(new Error(ack?.message || 'Failed to subscribe to group presence'));
          }
          resolve({
            groupId: ack.groupId,
            totalMembers: ack.totalMembers,
            onlineCount: ack.onlineCount,
            onlineMemberIds: ack.onlineMemberIds || [],
          });
        },
      );
    });
  }

  /**
   * Unsubscribe from presence for a group.
   */
  unsubscribeGroupPresence(groupId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe_group_presence', { groupId });
    }
  }

  /**
   * Register a listener for direct user presence updates.
   */
  onUserPresenceChanged(listener: UserPresenceListener): () => void {
    this.userPresenceListeners.add(listener);
    return () => {
      this.userPresenceListeners.delete(listener);
    };
  }

  /**
   * Register a listener for group presence updates.
   */
  onGroupPresenceChanged(listener: GroupPresenceListener): () => void {
    this.groupPresenceListeners.add(listener);
    return () => {
      this.groupPresenceListeners.delete(listener);
    };
  }
}

export const socketService = new SocketService();
