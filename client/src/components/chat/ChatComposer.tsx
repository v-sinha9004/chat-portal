import React, { useState, useRef, useMemo } from 'react';
import type { ChatMessage, AttachmentInfo } from '../../types';
import { AnnouncementComposer } from '../announcements/AnnouncementComposer';
import { DoubtComposer } from '../doubts/DoubtComposer';
import { CHAT_ACTION_ITEMS } from '../../config/chatActionsConfig';
import { PendingAttachmentBar } from './PendingAttachmentBar';
import { ReplyPreviewBar } from './composer/ReplyPreviewBar';
import { ComposerActionMenu } from './composer/ComposerActionMenu';
import type { PendingAttachmentState } from './hooks/useMediaAttachment';

interface ChatComposerProps {
  currentUserId: string | null;
  currentUserRole: string;
  isGroup: boolean;
  isMentor: boolean;
  groupName?: string;
  directUserName?: string;
  isSocketConnected: boolean;
  replyingTo: ChatMessage | null;
  pendingAttachment: PendingAttachmentState | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  inputText: string;
  getDisplayName: (userId: string) => string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onProcessSelectedFile: (file: File) => void;
  onRemovePendingAttachment: () => void;
  onCancelReply: () => void;
  onSendMessage: (
    text: string,
    options?: {
      isAnnouncement?: boolean;
      heading?: string;
      isDoubt?: boolean;
      doubtTopic?: string;
      attachments?: AttachmentInfo[];
    },
  ) => Promise<void>;
  onClearInput: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  currentUserRole,
  isGroup,
  isMentor,
  groupName,
  directUserName,
  isSocketConnected,
  replyingTo,
  pendingAttachment,
  fileInputRef,
  inputText,
  getDisplayName,
  onInputChange,
  onPaste,
  onProcessSelectedFile,
  onRemovePendingAttachment,
  onCancelReply,
  onSendMessage,
  onClearInput,
}) => {
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [announcementHeading, setAnnouncementHeading] = useState('');
  const [isDoubtMode, setIsDoubtMode] = useState(false);
  const [doubtTopic, setDoubtTopic] = useState('');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Available special actions for current conversation & user role
  const availableActions = useMemo(() => {
    return CHAT_ACTION_ITEMS.filter((item) =>
      item.isAvailable({
        isGroup,
        isMentor: !!isMentor,
        isAdmin: currentUserRole?.toUpperCase() === 'ADMIN',
        role: currentUserRole,
      }),
    );
  }, [isGroup, isMentor, currentUserRole]);

  const handleSelectAction = (actionId: string) => {
    setIsActionMenuOpen(false);
    if (actionId === 'announcement') {
      if (isAnnouncementMode) {
        setIsAnnouncementMode(false);
        setAnnouncementHeading('');
      } else {
        setIsAnnouncementMode(true);
        setIsDoubtMode(false);
        setDoubtTopic('');
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (actionId === 'doubt') {
      if (isDoubtMode) {
        setIsDoubtMode(false);
        setDoubtTopic('');
      } else {
        setIsDoubtMode(true);
        setIsAnnouncementMode(false);
        setAnnouncementHeading('');
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const canSubmit =
    (inputText.trim().length > 0 ||
      (pendingAttachment?.attachmentInfo != null && !pendingAttachment.isUploading)) &&
    !pendingAttachment?.isUploading &&
    !pendingAttachment?.error &&
    isSocketConnected &&
    (!isAnnouncementMode || announcementHeading.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const attachments = pendingAttachment?.attachmentInfo
      ? [pendingAttachment.attachmentInfo]
      : undefined;

    // Reset pending attachment state and revoke preview
    onRemovePendingAttachment();

    if (isAnnouncementMode) {
      if (!announcementHeading.trim()) return;
      onClearInput();
      const text = inputText;
      const heading = announcementHeading;
      setAnnouncementHeading('');
      setIsAnnouncementMode(false);
      await onSendMessage(text, { isAnnouncement: true, heading, attachments });
      return;
    }

    if (isDoubtMode) {
      onClearInput();
      const text = inputText;
      const topic = doubtTopic.trim() || undefined;
      setDoubtTopic('');
      setIsDoubtMode(false);
      await onSendMessage(text, { isDoubt: true, doubtTopic: topic, attachments });
      return;
    }

    onClearInput();
    const text = inputText;
    await onSendMessage(text, { attachments });
  };

  return (
    <>
      {/* Docked Reply Preview Bar */}
      {replyingTo && (
        <ReplyPreviewBar
          replyingTo={replyingTo}
          getDisplayName={getDisplayName}
          onCancel={onCancelReply}
        />
      )}

      {/* Announcement Composer (Only for mentors in groups) */}
      {isGroup && isMentor && isAnnouncementMode && (
        <AnnouncementComposer
          heading={announcementHeading}
          onHeadingChange={setAnnouncementHeading}
          onCancel={() => {
            setIsAnnouncementMode(false);
            setAnnouncementHeading('');
          }}
          disabled={!isSocketConnected}
        />
      )}

      {/* Doubt Composer */}
      {isDoubtMode && (
        <DoubtComposer
          topic={doubtTopic}
          onTopicChange={setDoubtTopic}
          onCancel={() => {
            setIsDoubtMode(false);
            setDoubtTopic('');
          }}
          disabled={!isSocketConnected}
        />
      )}

      {/* Docked Attachment Staging Bar */}
      {pendingAttachment && (
        <PendingAttachmentBar
          pendingAttachment={pendingAttachment}
          onRemove={onRemovePendingAttachment}
        />
      )}

      {/* Input Form */}
      <form
        className={`chat-input-form ${isAnnouncementMode ? 'announcement-form-active' : ''} ${
          isDoubtMode ? 'doubt-form-active' : ''
        }`}
        onSubmit={handleSubmit}
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              onProcessSelectedFile(files[0]);
            }
          }}
        />

        {/* Plus Action Button & Dropdown Menu */}
        <ComposerActionMenu
          isOpen={isActionMenuOpen}
          onToggle={() => setIsActionMenuOpen((prev) => !prev)}
          onClose={() => setIsActionMenuOpen(false)}
          availableActions={availableActions}
          isAnnouncementMode={isAnnouncementMode}
          isDoubtMode={isDoubtMode}
          onSelectAction={handleSelectAction}
        />

        {/* Paperclip Attachment Button */}
        <button
          type="button"
          className="chat-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image or PDF (max 5 MB)"
          aria-label="Attach file"
          disabled={!isSocketConnected || pendingAttachment?.isUploading}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          className={`chat-input ${isAnnouncementMode ? 'announcement-body-input' : ''} ${
            isDoubtMode ? 'doubt-body-input' : ''
          }`}
          placeholder={
            isSocketConnected
              ? isAnnouncementMode
                ? 'Type announcement message...'
                : isDoubtMode
                ? 'Type your doubt or question...'
                : isGroup && groupName
                ? `Message #${groupName}...`
                : directUserName
                ? `Message ${directUserName}...`
                : 'Type a message...'
              : 'Connecting to chat server...'
          }
          value={inputText}
          onChange={onInputChange}
          onPaste={onPaste}
          disabled={!isSocketConnected}
          autoFocus
        />
        <button
          type="submit"
          className={`chat-send-button ${isAnnouncementMode ? 'announcement-send-btn' : ''} ${
            isDoubtMode ? 'doubt-send-btn' : ''
          }`}
          disabled={!canSubmit}
        >
          {isAnnouncementMode ? 'Announce' : isDoubtMode ? 'Ask Doubt' : 'Send'}
        </button>
      </form>
    </>
  );
};
