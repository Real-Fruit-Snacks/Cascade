import { useEffect, useCallback, useRef, type RefObject } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Traps focus within a container element when active.
 * Auto-focuses the first focusable element on activation.
 * Restores focus to the previously focused element on deactivation.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Capture the element that had focus before the trap activates,
  // auto-focus first focusable element, and restore on deactivation
  useEffect(() => {
    if (!active || !ref.current) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const first = ref.current.querySelector<HTMLElement>(FOCUSABLE);
    if (first) {
      // Double-tap focus: rAF for fast path, setTimeout as fallback for WebView2 timing
      requestAnimationFrame(() => first.focus());
      setTimeout(() => { if (document.activeElement !== first) first.focus(); }, 50);
    }
    return () => {
      const el = previousFocusRef.current;
      if (el && typeof el.focus === 'function') {
        requestAnimationFrame(() => el.focus());
      }
    };
  }, [active, ref]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const focusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [ref]);

  return onKeyDown;
}
