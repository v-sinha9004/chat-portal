import React, { useRef, useEffect } from 'react';
import type { ChatActionItem } from '@/config/chatActionsConfig';

interface ComposerActionMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  availableActions: ChatActionItem[];
  isAnnouncementMode: boolean;
  isDoubtMode: boolean;
  onSelectAction: (actionId: string) => void;
}

export const ComposerActionMenu: React.FC<ComposerActionMenuProps> = ({
  isOpen,
  onToggle,
  onClose,
  availableActions,
  isAnnouncementMode,
  isDoubtMode,
  onSelectAction,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (availableActions.length === 0) return null;

  return (
    <div className="chat-action-menu-container" ref={containerRef}>
      <button
        type="button"
        className={`chat-action-plus-btn ${isOpen ? 'menu-open' : ''} ${
          isAnnouncementMode || isDoubtMode ? 'mode-active' : ''
        }`}
        onClick={onToggle}
        title="Add special message..."
        aria-label="Add special message options"
        aria-expanded={isOpen}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="plus-icon"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {isOpen && (
        <div className="chat-action-dropdown-menu">
          <div className="chat-action-menu-header">Special Message</div>
          {availableActions.map((action) => {
            const isCurrentActive =
              (action.id === 'announcement' && isAnnouncementMode) ||
              (action.id === 'doubt' && isDoubtMode);

            return (
              <button
                key={action.id}
                type="button"
                className={`chat-action-menu-item ${isCurrentActive ? 'item-active' : ''}`}
                onClick={() => onSelectAction(action.id)}
              >
                <span className="action-item-icon" style={{ color: action.accentColor }}>
                  {action.icon({ size: 18, color: action.accentColor })}
                </span>
                <div className="action-item-content">
                  <span className="action-item-label">{action.label}</span>
                  {action.description && (
                    <span className="action-item-desc">{action.description}</span>
                  )}
                </div>
                {isCurrentActive && <span className="action-item-badge">Active</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
