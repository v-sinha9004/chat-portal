import React, { useRef, useEffect } from 'react';
import { MegaphoneIcon } from './MegaphoneIcon';

interface AnnouncementComposerProps {
  heading: string;
  onHeadingChange: (val: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export const AnnouncementComposer: React.FC<AnnouncementComposerProps> = ({
  heading,
  onHeadingChange,
  onCancel,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus heading input when composer opens
    inputRef.current?.focus();
  }, []);

  return (
    <div className="announcement-composer-bar">
      <div className="announcement-composer-header">
        <div className="announcement-composer-badge">
          <MegaphoneIcon size={16} color="var(--announcement-subtext)" className="announcement-composer-icon" />
          <span>Mentor Announcement Mode</span>
        </div>
        <button
          type="button"
          className="announcement-cancel-btn"
          onClick={onCancel}
          title="Cancel announcement mode"
          aria-label="Cancel announcement mode"
          disabled={disabled}
        >
          ✕ Cancel
        </button>
      </div>

      <div className="announcement-heading-field">
        <input
          ref={inputRef}
          type="text"
          className="announcement-heading-input"
          placeholder="Announcement Heading (required)..."
          value={heading}
          onChange={(e) => onHeadingChange(e.target.value)}
          disabled={disabled}
          maxLength={150}
        />
        <span className="announcement-char-counter">
          {heading.length}/150
        </span>
      </div>
    </div>
  );
};
