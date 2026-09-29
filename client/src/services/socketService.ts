import { io, Socket } from 'socket.io-client';

export interface IncomingDirectMessageEvent {
  id: string;
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
  clientMessageId?: string;
  message?: string;
  data?: IncomingDirectMessageEvent;
}

type MessageListener = (event: IncomingDirectMessageEvent) => void;
type ConnectionListener = (connected: boolean) => void;

class SocketService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;
  private currentUserId: string | null = null;
  private messageListeners: Set<MessageListener> = new Set();
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
   * Register a listener for incoming messages.
   * Returns an unregister cleanup function.
   */
  onDirectMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
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
}

export const socketService = new SocketService();
