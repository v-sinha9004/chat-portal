import React from 'react';
import type { ChatMessage } from '@/types';
import { PinIcon } from '@/components/icons';

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
  onReportMessage: (message: ChatMessage) => void;
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
  onReportMessage,
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
      icon: <PinIcon size={15} filled={isPinned} />,
      onClick: () => (isPinned ? onUnpinMessage(message) : onPinMessage(message)),
    });
  }

  actions.push({
    id: 'report',
    label: 'Report',
    danger: true,
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
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
    onClick: () => onReportMessage(message),
  });

  return actions;
}


