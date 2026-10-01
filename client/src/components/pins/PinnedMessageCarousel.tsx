import React from 'react';
import { usePinsState, useChatActions } from '@/store';

interface PinnedMessageCarouselProps {
  onPinClick: (messageId: string) => void;
  canManagePins: boolean;
}

export const PinnedMessageCarousel: React.FC<PinnedMessageCarouselProps> = ({
  onPinClick,
  canManagePins,
}) => {
  const { pinnedMessages, activePinIndex } = usePinsState();
  const { nextPin, prevPin, unpinMessage } = useChatActions();

  if (!pinnedMessages || pinnedMessages.length === 0) {
    return null;
  }

  const safeIndex = Math.min(Math.max(0, activePinIndex), pinnedMessages.length - 1);
  const currentPin = pinnedMessages[safeIndex];
  if (!currentPin) return null;

  const { snapshot } = currentPin;
  const totalPins = pinnedMessages.length;

  const handleUnpin = (e: React.MouseEvent) => {
    e.stopPropagation();
    unpinMessage(currentPin.messageId);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    prevPin();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    nextPin();
  };

  return (
    <div className="pinned-carousel-container" role="region" aria-label="Pinned Messages">
      {/* Left Pin Icon & Indicator */}
      <div className="pinned-indicator-section">
        <span className="pinned-icon" aria-hidden="true">
          📌
        </span>
        <div className="pinned-meta-header">
          <span className="pinned-title">
            {totalPins > 1 ? `Pinned (${safeIndex + 1}/${totalPins})` : 'Pinned'}
          </span>
          {totalPins > 1 && (
            <div className="pinned-dots" aria-hidden="true">
              {pinnedMessages.map((_, idx) => (
                <span
                  key={idx}
                  className={`pinned-dot ${idx === safeIndex ? 'active' : ''}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area (Clickable -> Jump to message) */}
      <div
        className="pinned-content-card"
        onClick={() => onPinClick(currentPin.messageId)}
        role="button"
        tabIndex={0}
        title="Click to jump to pinned message"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPinClick(currentPin.messageId);
          }
        }}
      >
        <div className="pinned-snippet-row">
          {snapshot.isAnnouncement && (
            <span className="pinned-type-tag tag-announcement">
              📢 Announcement {snapshot.heading ? `• ${snapshot.heading}` : ''}
            </span>
          )}
          {snapshot.isDoubt && (
            <span
              className={`pinned-type-tag tag-doubt ${
                snapshot.doubtStatus === 'RESOLVED' ? 'resolved' : 'open'
              }`}
            >
              ❓ Doubt: {snapshot.doubtStatus || 'OPEN'}
            </span>
          )}
          {snapshot.senderName && (
            <span className="pinned-author">{snapshot.senderName}:</span>
          )}
          <span className="pinned-text-preview">
            {snapshot.content}
          </span>
        </div>
      </div>

      {/* Right Controls: Navigation & Unpin */}
      <div className="pinned-actions-section">
        {totalPins > 1 && (
          <div className="pinned-nav-arrows">
            <button
              type="button"
              className="pinned-nav-btn prev"
              onClick={handlePrev}
              title="Previous pinned message"
              aria-label="Previous pinned message"
            >
              ‹
            </button>
            <button
              type="button"
              className="pinned-nav-btn next"
              onClick={handleNext}
              title="Next pinned message"
              aria-label="Next pinned message"
            >
              ›
            </button>
          </div>
        )}

        {canManagePins && (
          <button
            type="button"
            className="pinned-unpin-btn"
            onClick={handleUnpin}
            title="Unpin message"
            aria-label="Unpin message"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
