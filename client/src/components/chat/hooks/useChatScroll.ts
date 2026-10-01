import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { ChatMessage } from '@/types';

interface UseChatScrollOptions {
  activeKey: string | null;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  isLoadingOlderMessages: boolean;
  loadOlderMessages: () => Promise<void>;
  hasNewerMessages: boolean;
  isLoadingNewerMessages: boolean;
  loadNewerMessages: () => Promise<void>;
  currentUserId: string | null;
  typingText?: string | null;
}

export function useChatScroll({
  activeKey,
  messages,
  isLoadingMessages,
  hasMoreMessages,
  isLoadingOlderMessages,
  loadOlderMessages,
  hasNewerMessages,
  isLoadingNewerMessages,
  loadNewerMessages,
  currentUserId,
  typingText,
}: UseChatScrollOptions) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const lastLoadedConvoKeyRef = useRef<string | null>(null);
  const justLoadedInitialRef = useRef<boolean>(false);
  const lastSeenTailMessageIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const isPrependingOlderRef = useRef<boolean>(false);
  const isJumpingToLatestRef = useRef<boolean>(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (behavior === 'auto' || behavior === 'instant') {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const triggerLoadOlder = useCallback(() => {
    if (
      isJumpingToLatestRef.current ||
      isLoadingOlderMessages ||
      !hasMoreMessages ||
      isLoadingMessages
    ) {
      return;
    }
    const container = messagesContainerRef.current;
    if (container) {
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      isPrependingOlderRef.current = true;
    }
    loadOlderMessages();
  }, [hasMoreMessages, isLoadingOlderMessages, isLoadingMessages, loadOlderMessages]);

  const handleScroll = useCallback(() => {
    if (isJumpingToLatestRef.current) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    // Trigger load when scrolled near the top
    if (container.scrollTop <= 60) {
      triggerLoadOlder();
    }

    // Trigger load newer messages when scrolled near bottom while in historical view
    if (
      hasNewerMessages &&
      !isLoadingNewerMessages &&
      !isLoadingMessages &&
      !isJumpingToLatestRef.current
    ) {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom <= 50) {
        loadNewerMessages();
      }
    }
  }, [
    triggerLoadOlder,
    hasNewerMessages,
    isLoadingNewerMessages,
    isLoadingMessages,
    loadNewerMessages,
  ]);

  // Restore scroll position after prepending older messages
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isPrependingOlderRef.current && prevScrollHeightRef.current > 0) {
      const heightDelta = container.scrollHeight - prevScrollHeightRef.current;
      if (heightDelta > 0) {
        container.scrollTop = prevScrollTopRef.current + heightDelta;
      }
      isPrependingOlderRef.current = false;
      prevScrollHeightRef.current = 0;
      prevScrollTopRef.current = 0;
    }
  }, [messages]);

  // Instant scroll to bottom on initial message load for a conversation
  useLayoutEffect(() => {
    if (!activeKey || isLoadingMessages) return;

    if (lastLoadedConvoKeyRef.current !== activeKey) {
      const scrollToBottomInstant = () => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      };

      scrollToBottomInstant();
      const rafId = requestAnimationFrame(scrollToBottomInstant);
      lastLoadedConvoKeyRef.current = activeKey;
      justLoadedInitialRef.current = true;
      lastSeenTailMessageIdRef.current = messages[messages.length - 1]?.id || null;

      return () => cancelAnimationFrame(rafId);
    }
  }, [activeKey, isLoadingMessages, messages]);

  // Smooth scroll for new incoming/outgoing messages or typing indicator
  useEffect(() => {
    if (!activeKey || isLoadingMessages) return;

    if (justLoadedInitialRef.current) {
      justLoadedInitialRef.current = false;
      return;
    }

    const currentTailId = messages[messages.length - 1]?.id || null;
    const hasNewTailMessage =
      currentTailId && currentTailId !== lastSeenTailMessageIdRef.current;
    lastSeenTailMessageIdRef.current = currentTailId;

    if (hasNewTailMessage) {
      if (hasNewerMessages || isLoadingNewerMessages || isJumpingToLatestRef.current) {
        return;
      }

      const container = messagesContainerRef.current;
      if (container) {
        const distanceFromBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        const isLatestMine = messages[messages.length - 1]?.senderId === currentUserId;
        if (isLatestMine || distanceFromBottom < 150) {
          scrollToBottom('smooth');
        }
      } else {
        scrollToBottom('smooth');
      }
      return;
    }

    if (typingText && messagesContainerRef.current && !hasNewerMessages) {
      const container = messagesContainerRef.current;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 150) {
        scrollToBottom('smooth');
      }
    }
  }, [
    messages,
    typingText,
    activeKey,
    isLoadingMessages,
    hasNewerMessages,
    isLoadingNewerMessages,
    currentUserId,
    scrollToBottom,
  ]);

  // Reset tracked conversation if none is selected
  useEffect(() => {
    if (!activeKey) {
      lastLoadedConvoKeyRef.current = null;
      lastSeenTailMessageIdRef.current = null;
    }
  }, [activeKey]);

  return {
    messagesContainerRef,
    messagesEndRef,
    isJumpingToLatestRef,
    scrollToBottom,
    triggerLoadOlder,
    handleScroll,
  };
}
