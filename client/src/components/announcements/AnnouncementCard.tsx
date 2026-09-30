import React from 'react';
import type { ChatMessage } from '../../types';
import { MegaphoneIcon } from './MegaphoneIcon';

interface AnnouncementCardProps {
  message: ChatMessage;
  senderDisplayName?: string;
  isMe: boolean;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  message,
  senderDisplayName,
  isMe,
}) => {
  return (
    <div
      className={`message-row announcement-row ${isMe ? 'sent' : 'received'}`}
      data-message-id={message.id}
    >
      <div className="announcement-card">
        {/* Top Accent Header Banner */}
        <div className="announcement-header-banner">
          <div className="announcement-badge-row">
            <span className="announcement-icon" aria-hidden="true">
              <MegaphoneIcon size={17} color="#ffffff" />
            </span>
            <span className="announcement-label">ANNOUNCEMENT</span>
          </div>

          <h4 className="announcement-headline">{message.heading || 'Announcement'}</h4>
        </div>

        {/* Announcement Message Body */}
        <div className="announcement-body">
          <p className="announcement-text">{message.text}</p>
        </div>

        {/* Card Footer: Sender Meta & Timestamp */}
        <div className="announcement-footer">
          <div className="announcement-author-info">
            {senderDisplayName && (
              <span className="announcement-sender-name">{senderDisplayName}</span>
            )}
            <span className="role-badge badge-mentor announcement-role-tag">MENTOR</span>
          </div>

          <div className="announcement-meta-right">
            <span className="announcement-timestamp">{message.timestamp}</span>
            {isMe && message.status && (
              <span
                className={`message-status status-${message.status}`}
                title={`Status: ${message.status.charAt(0).toUpperCase() + message.status.slice(1)}`}
              >
                {message.status === 'sending' && '⏱'}
                {message.status === 'sent' && '✓'}
                {message.status === 'delivered' && '✓✓'}
                {message.status === 'read' && '✓✓'}
                {message.status === 'failed' && '⚠️'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
