import React from 'react';

interface JumpToRecentPillProps {
  unseenCount: number;
  onJump: () => void;
}

export const JumpToRecentPill: React.FC<JumpToRecentPillProps> = ({
  unseenCount,
  onJump,
}) => {
  return (
    <div className="jump-to-recent-container">
      <button
        type="button"
        className="jump-to-recent-btn"
        onClick={onJump}
        title="Jump to latest messages"
      >
        <span>Jump to Recent Messages ↓</span>
        {unseenCount > 0 && (
          <span className="jump-to-recent-badge">
            {unseenCount > 99 ? '99+' : unseenCount}
          </span>
        )}
      </button>
    </div>
  );
};
