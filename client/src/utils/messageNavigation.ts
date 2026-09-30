/**
 * Utility functions for scrolling to and highlighting messages in the DOM.
 * Reusable across:
 * - Reply quotes navigation
 * - Pinned messages navigation
 * - Search results navigation
 */

export interface ScrollAndHighlightOptions {
  block?: ScrollLogicalPosition;
  behavior?: ScrollBehavior;
  highlightDurationMs?: number;
  highlightClass?: string;
}

/**
 * Attempts to smoothly scroll to a message DOM element and trigger a flashing highlight animation.
 * Returns true if the DOM element was found and scrolled, false otherwise.
 */
export function scrollToAndHighlightMessage(
  messageId: string,
  options: ScrollAndHighlightOptions = {},
): boolean {
  if (typeof document === 'undefined') return false;

  const {
    block = 'center',
    behavior = 'smooth',
    highlightDurationMs = 1500,
    highlightClass = 'highlight-pulse',
  } = options;

  const element = document.getElementById(`msg-${messageId}`);
  if (!element) {
    return false;
  }

  // Smoothly center the element in the view
  element.scrollIntoView({ behavior, block });

  // Retrigger CSS animation by removing, forcing reflow, and adding class
  element.classList.remove(highlightClass);
  void element.offsetWidth; // Force synchronous reflow
  element.classList.add(highlightClass);

  setTimeout(() => {
    element.classList.remove(highlightClass);
  }, highlightDurationMs);

  return true;
}

export interface NavigateToMessageOptions {
  scrollOptions?: ScrollAndHighlightOptions;
  onJumpingStateChange?: (isJumping: boolean) => void;
  cooldownMs?: number;
}

/**
 * Modular high-level navigation coordinator.
 * 1. Checks if target message element is already present in the active DOM.
 * 2. If present, immediately centers view and triggers flashing highlight.
 * 3. If absent (e.g. historical message), invokes the bidirectional window fetcher (jumpToMessage).
 * 4. Once loaded into state, waits for paint frame, centers the target element, and clears jumping lock.
 *
 * Reusable across:
 * - Quoted message replies (handleQuoteClick)
 * - Pinned message carousel jumps
 * - Search result navigation
 */
export async function navigateToMessage(
  targetMessageId: string,
  jumpToMessage: (id: string) => Promise<boolean>,
  options: NavigateToMessageOptions = {},
): Promise<boolean> {
  const cleanId = targetMessageId?.trim();
  if (!cleanId) return false;

  const { scrollOptions, onJumpingStateChange, cooldownMs = 400 } = options;

  // 1. Fast path: message already rendered in active DOM
  const scrolled = scrollToAndHighlightMessage(cleanId, scrollOptions);
  if (scrolled) {
    return true;
  }

  // 2. Context jump path: load bidirectional slice around target message
  onJumpingStateChange?.(true);
  try {
    const success = await jumpToMessage(cleanId);
    if (success) {
      requestAnimationFrame(() => {
        scrollToAndHighlightMessage(cleanId, scrollOptions);
        setTimeout(() => {
          onJumpingStateChange?.(false);
        }, cooldownMs);
      });
      return true;
    } else {
      onJumpingStateChange?.(false);
      return false;
    }
  } catch (err) {
    onJumpingStateChange?.(false);
    throw err;
  }
}

