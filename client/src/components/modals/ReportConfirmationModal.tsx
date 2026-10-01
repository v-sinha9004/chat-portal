import React, { useEffect } from 'react';
import type { ChatMessage } from '@/types';

interface ReportConfirmationModalProps {
  isOpen: boolean;
  message: ChatMessage | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const ReportConfirmationModal: React.FC<ReportConfirmationModalProps> = ({
  isOpen,
  message,
  onClose,
  onConfirm,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  const previewText =
    message.text ||
    (message.attachments?.length
      ? `[${message.attachments.length} attachment(s)]`
      : 'Message');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-icon" role="img" aria-label="report">
              🚩
            </span>
            <h3 id="report-modal-title">Report Message</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="report-modal-body">
          <p>
            Are you sure you want to report this message? Our moderation team will review it.
          </p>

          <div className="report-message-preview">
            &ldquo;
            {previewText.length > 140
              ? `${previewText.slice(0, 140)}...`
              : previewText}
            &rdquo;
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
            >
              Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
