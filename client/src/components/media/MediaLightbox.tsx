import React, { useEffect } from 'react';
import type { AttachmentInfo } from '@/types';

interface MediaLightboxProps {
  attachment: AttachmentInfo | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({ attachment, onClose }) => {
  useEffect(() => {
    if (!attachment) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachment, onClose]);

  if (!attachment) return null;

  return (
    <div
      className="media-lightbox-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div className="media-lightbox-container" onClick={(e) => e.stopPropagation()}>
        <div className="media-lightbox-header">
          <div className="media-lightbox-meta">
            <span className="media-lightbox-title" title={attachment.fileName}>
              {attachment.fileName}
            </span>
            <span className="media-lightbox-sub">{formatFileSize(attachment.fileSize)}</span>
          </div>

          <div className="media-lightbox-actions">
            <a
              href={attachment.url}
              download={attachment.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="media-lightbox-btn download-btn"
              title="Download image"
              aria-label="Download image"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download</span>
            </a>

            <button
              type="button"
              className="media-lightbox-btn close-btn"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close image preview"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="media-lightbox-content">
          <img
            src={attachment.url}
            alt={attachment.fileName}
            className="media-lightbox-image"
          />
        </div>
      </div>
    </div>
  );
};
