import React, { useState, useRef, useEffect } from 'react';

interface SidebarHeaderProps {
  totalConversations: number;
  isLoading: boolean;
  onOpenCreateGroup: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  totalConversations,
  isLoading,
  onOpenCreateGroup,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu if clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div className="sidebar-header">
      <div className="sidebar-title-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2>Chats</h2>
          <span className="user-count-badge">
            {isLoading ? '...' : `${totalConversations}`}
          </span>
        </div>

        {/* '+' Button & Dropdown Menu */}
        <div className="sidebar-action-wrapper" ref={menuRef}>
          <button
            type="button"
            className="action-add-btn"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            title="New chat options"
            aria-label="New chat options"
            aria-expanded={isMenuOpen}
          >
            +
          </button>

          {isMenuOpen && (
            <div className="action-dropdown-menu">
              <button
                type="button"
                className="dropdown-menu-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenCreateGroup();
                }}
              >
                <span className="dropdown-item-icon">👥</span>
                <div className="dropdown-item-text">
                  <span className="dropdown-item-title">Create Group</span>
                  <span className="dropdown-item-desc">Chat with multiple members</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="sidebar-subtitle">Direct messages and group conversations</p>
    </div>
  );
};
