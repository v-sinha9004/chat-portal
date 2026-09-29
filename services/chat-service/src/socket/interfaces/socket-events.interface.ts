import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    [key: string]: any;
  };
}

export interface DirectMessagePayload {
  recipientId: string;
  message: string;
  clientMessageId?: string;
  [key: string]: any;
}

export interface NewMessageEvent<T = any> {
  id: string;
  senderId: string;
  recipientId: string;
  data: T;
  timestamp: string;
  clientMessageId?: string;
}
