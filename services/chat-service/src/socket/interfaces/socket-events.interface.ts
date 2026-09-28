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
  [key: string]: any;
}

export interface NewMessageEvent<T = any> {
  senderId: string;
  recipientId: string;
  data: T;
  timestamp: string;
}
