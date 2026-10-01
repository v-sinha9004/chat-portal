import React from 'react';
import type { PendingAttachmentState } from './hooks/useMediaAttachment';

interface PendingAttachmentBarProps {
  pendingAttachment: PendingAttachmentState;
  onRemove: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const PendingAttachmentBar: React.FC<PendingAttachmentBarProps> = ({
  pendingAttachment,
  onRemove,
}) => {
  return (
    <div className={`attachment-staging-bar ${pendingAttachment.error ? 'staging-error' : ''}`}>
      <div className="attachment-staging-chip">
        {pendingAttachment.isImage ? (
          <div className="attachment-staging-thumb-wrapper">
            <img
              src={pendingAttachment.previewUrl}
              alt={pendingAttachment.fileName}
              className="attachment-staging-thumb"
            />
            {pendingAttachment.isUploading && (
              <div className="attachment-staging-spinner-overlay">
                <div className="attachment-staging-spinner" />
              </div>
            )}
          </div>
        ) : (
          <div className="attachment-staging-pdf-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
        )}
        <div className="attachment-staging-info">
          <span className="attachment-staging-name" title={pendingAttachment.fileName}>
            {pendingAttachment.fileName}
          </span>
          <div className="attachment-staging-meta">
            <span className="attachment-staging-size">
              {formatFileSize(pendingAttachment.fileSize)}
            </span>
            {pendingAttachment.isUploading && (
              <span className="attachment-staging-status uploading">
                Uploading {pendingAttachment.uploadProgress}%
              </span>
            )}
            {!pendingAttachment.isUploading && !pendingAttachment.error && (
              <span className="attachment-staging-status ready">✓ Ready to send</span>
            )}
            {pendingAttachment.error && (
              <span className="attachment-staging-status error">
                ⚠️ {pendingAttachment.error}
              </span>
            )}
          </div>
          {pendingAttachment.isUploading && (
            <div className="attachment-staging-progress-bar-bg">
              <div
                className="attachment-staging-progress-bar-fill"
                style={{ width: `${pendingAttachment.uploadProgress}%` }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          className="attachment-staging-remove-btn"
          onClick={onRemove}
          title="Remove attachment"
          aria-label="Remove attachment"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
