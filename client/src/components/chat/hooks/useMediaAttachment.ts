import { useState, useRef, useCallback, useEffect } from 'react';
import type { AttachmentInfo } from '../../../types';
import { validateMediaFile, uploadMediaAttachment } from '../../../utils/mediaUpload';
import { useAuthStore } from '../../../store/useAuthStore';

export interface PendingAttachmentState {
  file: File;
  previewUrl: string;
  isImage: boolean;
  fileName: string;
  fileSize: number;
  isUploading: boolean;
  uploadProgress: number;
  error?: string | null;
  attachmentInfo?: AttachmentInfo | null;
  abortController?: AbortController;
}

interface UseMediaAttachmentOptions {
  activeConversationId?: string | null;
}

export function useMediaAttachment({ activeConversationId }: UseMediaAttachmentOptions) {
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachmentState | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRemovePendingAttachment = useCallback(() => {
    setPendingAttachment((prev) => {
      if (prev) {
        if (prev.abortController) {
          prev.abortController.abort();
        }
        if (prev.previewUrl) {
          URL.revokeObjectURL(prev.previewUrl);
        }
      }
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const processSelectedFile = useCallback(
    async (file: File) => {
      if (!activeConversationId) return;

      const validation = validateMediaFile(file);
      if (!validation.valid) {
        alert(validation.error || 'Invalid file');
        return;
      }

      // If there's an existing upload, abort and cleanup
      handleRemovePendingAttachment();

      const isImage = file.type.startsWith('image/');
      const previewUrl = URL.createObjectURL(file);
      const abortController = new AbortController();

      setPendingAttachment({
        file,
        previewUrl,
        isImage,
        fileName: file.name,
        fileSize: file.size,
        isUploading: true,
        uploadProgress: 0,
        abortController,
      });

      try {
        const token = useAuthStore.getState().accessToken;
        if (!token) throw new Error('Not authenticated');

        const attachmentInfo = await uploadMediaAttachment(
          file,
          activeConversationId,
          token,
          {
            onProgress: (percent) => {
              setPendingAttachment((prev) =>
                prev ? { ...prev, uploadProgress: percent } : null,
              );
            },
            signal: abortController.signal,
          },
        );

        setPendingAttachment((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            isUploading: false,
            uploadProgress: 100,
            attachmentInfo,
          };
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Upload failed';
        setPendingAttachment((prev) =>
          prev
            ? {
                ...prev,
                isUploading: false,
                error: message,
              }
            : null,
        );
      }
    },
    [activeConversationId, handleRemovePendingAttachment],
  );

  // Clean up pending attachment if conversation switches
  const prevConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    if (prevConversationIdRef.current !== activeConversationId) {
      prevConversationIdRef.current = activeConversationId;
      handleRemovePendingAttachment();
    }
  }, [activeConversationId, handleRemovePendingAttachment]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment?.previewUrl]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      dragCounterRef.current = 0;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        processSelectedFile(file);
      }
    },
    [processSelectedFile],
  );

  // Clipboard paste handler
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
          e.preventDefault();
          processSelectedFile(file);
        }
      }
    },
    [processSelectedFile],
  );

  return {
    pendingAttachment,
    isDraggingOver,
    fileInputRef,
    handleRemovePendingAttachment,
    processSelectedFile,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
  };
}
