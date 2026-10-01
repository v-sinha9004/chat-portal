import React, { useEffect, useRef, useState } from 'react';
import type { MessageActionItem } from './messageActions';

interface MessageActionMenuProps {
  actions: MessageActionItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
  actions,
  isOpen,
  onToggle,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  // Position detection (flip upwards if near bottom of screen)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const dropdownEstimatedHeight = actions.length * 40 + 20;

      if (rect.bottom + dropdownEstimatedHeight > windowHeight) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen, actions.length]);

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
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`message-action-dropdown ${openUpward ? 'open-upward' : 'open-downward'}`}
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
