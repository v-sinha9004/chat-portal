import React from 'react';

interface TypingIndicatorBarProps {
  typingText: string;
}

export const TypingIndicatorBar: React.FC<TypingIndicatorBarProps> = ({ typingText }) => {
  return (
    <div className="typing-indicator-bar" aria-live="polite">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-indicator-text">{typingText}</span>
    </div>
  );
};
