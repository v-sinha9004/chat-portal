import { Socket } from 'socket.io';

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: string;
  [key: string]: any;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    user?: JwtUserPayload;
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

export interface GroupMessagePayload {
  groupId: string;
  message: string;
  clientMessageId?: string;
  [key: string]: any;
}

export interface GroupMessageEvent<T = any> {
  id: string;
  groupId: string;
  senderId: string;
  data: T;
  timestamp: string;
  clientMessageId?: string;
}

