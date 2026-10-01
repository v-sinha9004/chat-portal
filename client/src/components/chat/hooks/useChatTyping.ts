import { useState, useRef, useCallback, useEffect } from 'react';

interface UseChatTypingOptions {
  activeConversationId?: string | null;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
}

export function useChatTyping({
  activeConversationId,
  sendTypingStart,
  sendTypingStop,
}: UseChatTypingOptions) {
  const [inputText, setInputText] = useState('');
  const isTypingRef = useRef(false);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTyping = useCallback(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingStop();
    }
  }, [sendTypingStop]);

  // Handle typing input changes with 2.5s debounce and 3s heartbeat
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputText(val);

      if (!val.trim()) {
        stopTyping();
        return;
      }

      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTypingStart();

        // Refresh every 3 seconds while user continues typing continuously
        heartbeatIntervalRef.current = setInterval(() => {
          if (isTypingRef.current) {
            sendTypingStart();
          }
        }, 3000);
      }

      // Reset 2.5s pause timeout
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
      pauseTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2500);
    },
    [sendTypingStart, stopTyping],
  );

  // Stop typing if user switches conversation or unmounts
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [activeConversationId, stopTyping]);

  return {
    inputText,
    setInputText,
    handleInputChange,
    stopTyping,
  };
}
