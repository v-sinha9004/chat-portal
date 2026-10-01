import React from 'react';
import type { ChatMessage } from '@/types';

export interface MessageActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void | Promise<void>;
  danger?: boolean;
}

export interface BuildMessageActionsParams {
  message: ChatMessage;
  isPinned: boolean;
  canManagePins: boolean;
  onInitiateReply: (message: ChatMessage) => void;
  onPinMessage: (message: ChatMessage) => Promise<void>;
  onUnpinMessage: (message: ChatMessage) => Promise<void>;
}

/**
 * Easily configurable action builder for messages.
 * Any new action (e.g. Copy, Forward, Delete) can simply be added here.
 */
export function getMessageActions({
  message,
  isPinned,
  canManagePins,
  onInitiateReply,
  onPinMessage,
  onUnpinMessage,
}: BuildMessageActionsParams): MessageActionItem[] {
  const actions: MessageActionItem[] = [
    {
      id: 'reply',
      label: 'Reply',
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 17 4 12 9 7" />
          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
        </svg>
      ),
      onClick: () => onInitiateReply(message),
    },
  ];

  if (canManagePins) {
    actions.push({
      id: 'pin',
      label: isPinned ? 'Unpin message' : 'Pin message',
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={isPinned ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="17" x2="12" y2="22" />
          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
        </svg>
      ),
      onClick: () => (isPinned ? onUnpinMessage(message) : onPinMessage(message)),
    });
  }

  return actions;
}
