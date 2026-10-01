import React from 'react';
import type { ChatMessage } from '@/types';
import { PinIcon, ReplyIcon, ReportIcon } from '@/components/icons';

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
  canManagePins?: boolean;
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
  onInitiateReply,
  onPinMessage,
  onUnpinMessage,
  onReportMessage,
}: BuildMessageActionsParams): MessageActionItem[] {
  const actions: MessageActionItem[] = [
    {
      id: 'reply',
      label: 'Reply',
      icon: <ReplyIcon size={15} />,
      onClick: () => onInitiateReply(message),
    },
    {
      id: 'pin',
      label: isPinned ? 'Unpin message' : 'Pin message',
      icon: <PinIcon size={15} filled={isPinned} />,
      onClick: () => (isPinned ? onUnpinMessage(message) : onPinMessage(message)),
    },
    {
      id: 'report',
      label: 'Report',
      danger: true,
      icon: <ReportIcon size={15} />,
      onClick: () => onReportMessage(message),
    },
  ];

  return actions;
}



