import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface TooltipProps {
  label: string;
  children: ReactNode;
  /** Placement relative to the trigger element */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay in ms before showing (default 400) */
  delay?: number;
}

export function Tooltip({ label, children, side = 'top', delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    clearTimeout(exitTimerRef.current);
    setIsExiting(false);
    timerRef.current = setTimeout(() => {
      const wrapper = triggerRef.current;
      if (!wrapper) return;
      // display:contents makes the wrapper invisible to layout,
      // so get the rect from the first child element instead
      const el = (wrapper.firstElementChild as HTMLElement) ?? wrapper;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const gap = 6;
      let top = 0;
      let left = 0;

      switch (side) {
        case 'top':
          top = rect.top - gap;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - gap;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + gap;
          break;
      }

      setPos({ top, left });
      setVisible(true);
    }, delay);
  }, [side, delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    if (visible) {
      setIsExiting(true);
      exitTimerRef.current = setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
      }, 100);
    }
  }, [visible]);

  // Dismiss tooltip when any click happens anywhere in the document,
  // or when the window loses focus (e.g. modal overlay steals events)
  useEffect(() => {
    if (!visible) return;
    const dismiss = () => {
      setIsExiting(true);
      exitTimerRef.current = setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
      }, 100);
    };
    document.addEventListener('mousedown', dismiss, true);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('mousedown', dismiss, true);
      window.removeEventListener('blur', dismiss);
    };
  }, [visible]);

  const transform = side === 'top'
    ? 'translate(-50%, -100%)'
    : side === 'bottom'
      ? 'translate(-50%, 0)'
      : side === 'left'
        ? 'translate(-100%, -50%)'
        : 'translate(0, -50%)';

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={show}
      onBlur={hide}
      style={{ display: 'contents' }}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform,
            zIndex: 100,
            padding: '4px 8px',
            fontSize: '0.6875rem',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            color: 'var(--ctp-text)',
            backgroundColor: 'var(--ctp-surface1)',
            border: '1px solid var(--ctp-surface2)',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            animation: isExiting ? 'tooltip-fade-out 0.1s ease-in forwards' : 'tooltip-fade-in 0.1s ease-out',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
