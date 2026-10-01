import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  threshold?: number;
  moveThreshold?: number;
  onLongPress: () => void;
}

/**
 * Reusable hook to handle mobile long-press gestures.
 * Automatically cancels if touch moves (e.g. while scrolling).
 */
export function useLongPress({
  threshold = 450,
  moveThreshold = 10,
  onLongPress,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(
    (clientX: number, clientY: number) => {
      isLongPressRef.current = false;
      startCoordsRef.current = { x: clientX, y: clientY };

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(40);
          } catch {
            // Ignore vibration errors if restricted by browser
          }
        }
        onLongPress();
      }, threshold);
    },
    [threshold, onLongPress]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startCoordsRef.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        start(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [start]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startCoordsRef.current && e.touches.length === 1) {
        const deltaX = Math.abs(e.touches[0].clientX - startCoordsRef.current.x);
        const deltaY = Math.abs(e.touches[0].clientY - startCoordsRef.current.y);
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
          cancel();
        }
      }
    },
    [moveThreshold, cancel]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (isLongPressRef.current) {
        // Prevent accidental touch click right after long press trigger
        e.preventDefault();
      }
      cancel();
    },
    [cancel]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: cancel,
  };
}
