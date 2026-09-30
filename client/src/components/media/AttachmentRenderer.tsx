import React, { useState } from 'react';
import type { AttachmentInfo } from '../../types';

interface AttachmentRendererProps {
  attachments: AttachmentInfo[];
  onOpenLightbox?: (attachment: AttachmentInfo) => void;
  isSentByMe?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ImageAttachmentProps {
  attachment: AttachmentInfo;
  onOpenLightbox?: (attachment: AttachmentInfo) => void;
}

const ImageAttachmentItem: React.FC<ImageAttachmentProps> = ({ attachment, onOpenLightbox }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Compute aspect ratio or dimension bounds
  const width = attachment.width || 400;
  const height = attachment.height || 300;
  const aspectRatio = `${width} / ${height}`;

  return (
    <div
      className="attachment-image-card"
      style={{ aspectRatio }}
      onClick={() => onOpenLightbox && onOpenLightbox(attachment)}
      role="button"
      tabIndex={0}
      title="Click to view full image"
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onOpenLightbox) {
          e.preventDefault();
          onOpenLightbox(attachment);
        }
      }}
    >
      {/* 0ms Tiny blurred placeholder preview */}
      {attachment.blurhash && (
        <img
          src={attachment.blurhash}
          alt=""
          aria-hidden="true"
          className={`attachment-image-blur ${isLoaded ? 'fade-out' : ''}`}
        />
      )}

      {/* Main high-res WebP/image */}
      {!hasError ? (
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className={`attachment-image-main ${isLoaded ? 'loaded' : ''}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : (
        <div className="attachment-image-error">
          <span>⚠️ Failed to load image</span>
        </div>
      )}

      {/* Hover Zoom Indicator */}
      <div className="attachment-image-hover-overlay">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>
    </div>
  );
};

interface PdfAttachmentProps {
  attachment: AttachmentInfo;
  isSentByMe?: boolean;
}

const PdfAttachmentItem: React.FC<PdfAttachmentProps> = ({ attachment, isSentByMe }) => {
  return (
    <div className={`attachment-pdf-card ${isSentByMe ? 'sent' : 'received'}`}>
      <div className="attachment-pdf-icon-box">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span className="attachment-pdf-tag">PDF</span>
      </div>

      <div className="attachment-pdf-info">
        <span className="attachment-pdf-filename" title={attachment.fileName}>
          {attachment.fileName}
        </span>
        <span className="attachment-pdf-filesize">
          {formatFileSize(attachment.fileSize)}
        </span>
      </div>

      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        download={attachment.fileName}
        className="attachment-pdf-action-btn"
        title={`Download ${attachment.fileName}`}
        aria-label={`Download ${attachment.fileName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>
    </div>
  );
};

export const AttachmentRenderer: React.FC<AttachmentRendererProps> = ({
  attachments,
  onOpenLightbox,
  isSentByMe,
}) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="message-attachments-container">
      {attachments.map((att, idx) => {
        const isPdf = att.mimeType === 'application/pdf' || att.type === 'file';
        if (isPdf) {
          return (
            <PdfAttachmentItem
              key={att.fileId || `pdf-${idx}`}
              attachment={att}
              isSentByMe={isSentByMe}
            />
          );
        }

        return (
          <ImageAttachmentItem
            key={att.fileId || `img-${idx}`}
            attachment={att}
            onOpenLightbox={onOpenLightbox}
          />
        );
      })}
    </div>
  );
};
