import React, { useEffect, useRef, useState } from 'react';
import type { MessageActionItem } from './messageActions';
import { ChevronDownIcon } from '@/components/icons';

interface MessageActionMenuProps {
  actions: MessageActionItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isMe?: boolean;
}

export const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
  actions,
  isOpen,
  onToggle,
  onClose,
  isMe = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const [openDirection, setOpenDirection] = useState<'left' | 'right'>(isMe ? 'left' : 'right');

  // Position detection (vertical flip if near bottom, horizontal flip if near container edge)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const dropdownEstimatedHeight = actions.length * 40 + 20;
      const dropdownEstimatedWidth = 170;

      // Vertical flip detection
      if (rect.bottom + dropdownEstimatedHeight > windowHeight) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }

      // Horizontal flip detection based on chat container or viewport bounds
      const chatContainer = containerRef.current.closest('.chat-messages-container');
      const containerLeft = chatContainer ? chatContainer.getBoundingClientRect().left : 0;
      const containerRight = chatContainer ? chatContainer.getBoundingClientRect().right : window.innerWidth;

      const preferred = isMe ? 'left' : 'right';

      if (preferred === 'right') {
        if (rect.left + dropdownEstimatedWidth > containerRight - 12) {
          setOpenDirection('left');
        } else {
          setOpenDirection('right');
        }
      } else {
        if (rect.right - dropdownEstimatedWidth < containerLeft + 12) {
          setOpenDirection('right');
        } else {
          setOpenDirection('left');
        }
      }
    }
  }, [isOpen, actions.length, isMe]);

  // Click outside and Escape key detection
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (actions.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`message-action-container ${isOpen ? 'menu-open' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Simple white chevron icon with no background */}
      <button
        type="button"
        className={`message-action-trigger ${isOpen ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title="Message options"
        aria-label="Message options"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <ChevronDownIcon size={14} color="#ffffff" strokeWidth={2.5} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`message-action-dropdown ${openUpward ? 'open-upward' : 'open-downward'} ${
            openDirection === 'left' ? 'open-left' : 'open-right'
          }`}
          role="menu"
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className={`message-action-dropdown-item ${action.danger ? 'danger' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                action.onClick();
              }}
            >
              <span className="message-action-item-icon">{action.icon}</span>
              <span className="message-action-item-label">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
