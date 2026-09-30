import React from 'react';
import { MegaphoneIcon } from '../components/announcements/MegaphoneIcon';
import { QuestionMarkIcon } from '../components/doubts/QuestionMarkIcon';

export interface ChatActionContext {
  isGroup: boolean;
  isMentor: boolean;
  isAdmin: boolean;
  role: string;
}

export interface ChatActionItem {
  id: 'announcement' | 'doubt' | string;
  label: string;
  description: string;
  icon: (props: { size?: number; color?: string; className?: string }) => React.ReactNode;
  accentColor: string;
  isAvailable: (ctx: ChatActionContext) => boolean;
}

/**
 * Extensible configuration of actions shown in the "+" message menu.
 * To add new types (e.g., Poll, Code Snippet, Assignment), simply append
 * an entry here with its availability rule and icon.
 */
export const CHAT_ACTION_ITEMS: ChatActionItem[] = [
  {
    id: 'announcement',
    label: 'Announcement',
    description: 'Broadcast an update to the group',
    icon: (props) => <MegaphoneIcon {...props} />,
    accentColor: '#ea580c',
    isAvailable: ({ isGroup, isMentor, isAdmin }) => isGroup && (isMentor || isAdmin),
  },
  {
    id: 'doubt',
    label: 'Doubt',
    description: 'Ask a question or raise a doubt',
    icon: (props) => <QuestionMarkIcon {...props} />,
    accentColor: '#8b5cf6',
    isAvailable: () => true, // Available in both direct and group chats
  },
];
