import { ChatMessageResponse } from './message-response.interface';

export interface DoubtsListResponse {
  conversationId: string;
  doubts: ChatMessageResponse[];
  total: number;
  openCount: number;
  resolvedCount: number;
}

export interface MentorDoubtsResponse {
  totalDoubtCount: number;
  openCount: number;
  resolvedCount: number;
  doubts: ChatMessageResponse[];
}
