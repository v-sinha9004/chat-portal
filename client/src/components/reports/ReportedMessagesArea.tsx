import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { fetchReportedMessages } from '@/services/chatService';
import type { ReportedMessageItem, AttachmentInfo } from '@/types';
import { AttachmentRenderer } from '@/components/media';
import { MediaLightbox } from '@/components/media/MediaLightbox';

function formatReportedTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) {
    return timeStr;
  }

  const dateStrFormatted = d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  return `${dateStrFormatted}, ${timeStr}`;
}

function formatFullDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
}

export const ReportedMessagesArea: React.FC = () => {
  const token = useAuthStore((s) => s.accessToken);
  const closeReportsView = useUIStore((s) => s.closeReportsView);

  const [reports, setReports] = useState<ReportedMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxAttachment, setLightboxAttachment] = useState<AttachmentInfo | null>(null);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchReportedMessages(token, { limit: 100 });
      setReports(response.reports || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load reported messages';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let ignore = false;
    if (!token) return;

    fetchReportedMessages(token, { limit: 100 })
      .then((response) => {
        if (!ignore) {
          setReports(response.reports || []);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load reported messages';
          setError(msg);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  return (
    <main className="chat-main reported-messages-view">
      {/* Header */}
      <header className="chat-header reported-messages-header">
        <div className="reported-header-left">
          <button
            type="button"
            className="mobile-back-btn"
            onClick={closeReportsView}
            title="Back to conversations"
            aria-label="Back to conversations"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="reported-header-details">
            <div className="reported-header-title-row">
              <h3>Reported Messages</h3>
              {!isLoading && (
                <span className="reported-count-badge">
                  {reports.length} {reports.length === 1 ? 'report' : 'reports'}
                </span>
              )}
            </div>
            <span className="reported-header-sub">
              Admin review for flagged messages
            </span>
          </div>
        </div>

        <div className="reported-header-actions">
          <button
            type="button"
            className="reported-icon-btn"
            onClick={loadReports}
            title="Refresh reports"
            aria-label="Refresh reports"
            disabled={isLoading}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: isLoading ? 'spin 1s linear infinite' : undefined }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>

          <button
            type="button"
            className="reported-close-btn"
            onClick={closeReportsView}
            title="Back to Chat"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Back to Chat</span>
          </button>
        </div>
      </header>

      {/* Body: Reported Message Bubbles */}
      <div className="reported-messages-container">
        {isLoading ? (
          <div className="messages-loading-state" style={{ margin: 'auto' }}>
            <div className="loading-spinner large" />
            <span>Loading reported messages...</span>
          </div>
        ) : error ? (
          <div className="messages-error-state" style={{ margin: 'auto' }}>
            <div className="empty-icon">⚠️</div>
            <p>{error}</p>
            <button
              type="button"
              className="load-older-btn"
              onClick={loadReports}
            >
              Try Again
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-message-box" style={{ margin: 'auto' }}>
            <div className="empty-icon">🛡️</div>
            <h3>No Reported Messages</h3>
            <p>There are currently no messages reported by users.</p>
          </div>
        ) : (
          reports.map((report) => {
            const reportedTimeFormatted = formatReportedTime(
              report.reportedAt || report.createdAt,
            );
            const fullDateTooltip = formatFullDate(
              report.reportedAt || report.createdAt,
            );
            const reporterDisplayName =
              report.reportedByName || report.reporterName || 'Unknown User';
            const senderDisplayName = report.senderName || 'Unknown User';

            return (
              <div
                key={report.id}
                className="message-row received reported-message-row"
              >
                <div className="message-bubble-wrapper reported-bubble-wrapper">
                  <div className="message-bubble reported-bubble">
                    {/* Bubble Header: Sender Name & Type */}
                    <div className="reported-bubble-header">
                      <span className="reported-sender-name">
                        <span className="reported-sender-prefix">From:</span>{' '}
                        {senderDisplayName}
                      </span>
                      {report.message.type && (
                        <span className="reported-type-badge">
                          {report.message.type === 'group'
                            ? 'Group Message'
                            : 'Direct Message'}
                        </span>
                      )}
                    </div>

                    {/* Quoted Reply Card (if any) */}
                    {report.message.replyTo && (
                      <div className="reply-quote-card">
                        <div className="reply-quote-bar" />
                        <div className="reply-quote-body">
                          <span className="reply-quote-sender">Quoted reply</span>
                          <p className="reply-quote-snippet">
                            {report.message.replyTo.text}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Announcement Heading (if any) */}
                    {report.message.heading && (
                      <h4
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          margin: '4px 0',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {report.message.heading}
                      </h4>
                    )}

                    {/* Media Attachments */}
                    {report.message.attachments &&
                      report.message.attachments.length > 0 && (
                        <AttachmentRenderer
                          attachments={report.message.attachments}
                          onOpenLightbox={(att) => setLightboxAttachment(att)}
                          isSentByMe={false}
                        />
                      )}

                    {/* Message Text */}
                    {(report.message.text || report.message.content) && (
                      <p className="reported-message-text">
                        {report.message.text || report.message.content}
                      </p>
                    )}

                    {/* Report Metadata Footer */}
                    <div className="reported-bubble-footer">
                      <div className="reported-footer-main">
                        <span className="reported-by-info">
                          <span className="reported-flag-icon">🚩</span>
                          Reported by <strong>{reporterDisplayName}</strong>
                        </span>

                        <span
                          className="reported-time-info"
                          title={`Reported at ${fullDateTooltip}`}
                        >
                          ⏱ Reported {reportedTimeFormatted}
                        </span>
                      </div>

                      {report.reason && (
                        <div className="reported-reason-info">
                          <span className="reported-reason-label">Reason:</span>
                          {report.reason}
                        </div>
                      )}

                      <div className="reported-status-badge-row">
                        <span
                          className={`reported-status-pill status-${(
                            report.status || 'pending'
                          ).toLowerCase()}`}
                        >
                          {report.status || 'PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Lightbox for images/media */}
      <MediaLightbox
        attachment={lightboxAttachment}
        onClose={() => setLightboxAttachment(null)}
      />
    </main>
  );
};
