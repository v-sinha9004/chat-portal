import React, { useRef, useEffect } from 'react';
import { QuestionMarkIcon } from '../Icons';

interface DoubtComposerProps {
  topic: string;
  onTopicChange: (val: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export const DoubtComposer: React.FC<DoubtComposerProps> = ({
  topic,
  onTopicChange,
  onCancel,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus topic input when composer opens
    inputRef.current?.focus();
  }, []);

  return (
    <div className="doubt-composer-bar">
      <div className="doubt-composer-header">
        <div className="doubt-composer-badge">
          <QuestionMarkIcon size={16} color="var(--doubt-accent, #8b5cf6)" className="doubt-composer-icon" />
          <span>Ask as Doubt Mode</span>
        </div>
        <button
          type="button"
          className="doubt-cancel-btn"
          onClick={onCancel}
          title="Cancel doubt mode"
          aria-label="Cancel doubt mode"
          disabled={disabled}
        >
          ✕ Cancel
        </button>
      </div>

      <div className="doubt-topic-field">
        <input
          ref={inputRef}
          type="text"
          className="doubt-topic-input"
          placeholder="Topic or Concept (optional, e.g. Dijkstra's Algorithm, Q3 on Binary Trees)..."
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          disabled={disabled}
          maxLength={100}
        />
        <span className="doubt-char-counter">
          {topic.length}/100
        </span>
      </div>
    </div>
  );
};
