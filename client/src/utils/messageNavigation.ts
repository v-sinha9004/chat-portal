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
