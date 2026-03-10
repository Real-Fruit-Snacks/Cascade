import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  danger?: boolean;
  separator?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const buttons = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? [],
        );
        if (buttons.length === 0) return;
        const focused = document.activeElement as HTMLButtonElement;
        const idx = buttons.indexOf(focused);
        if (e.key === 'Home') {
          buttons[0].focus();
        } else if (e.key === 'End') {
          buttons[buttons.length - 1].focus();
        } else if (e.key === 'ArrowDown') {
          buttons[(idx + 1) % buttons.length].focus();
        } else {
          buttons[(idx - 1 + buttons.length) % buttons.length].focus();
        }
      }
    };
    window.addEventListener('mousedown', handle);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handle);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Keep menu within viewport
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      ref.current.style.left = `${window.innerWidth - rect.width - 4}px`;
    }
    if (rect.bottom > window.innerHeight) {
      ref.current.style.top = `${window.innerHeight - rect.height - 4}px`;
    }
  }, [x, y]);

  // Auto-focus first menu item on mount
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]');
    first?.focus();
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[100] py-1 rounded-lg overflow-hidden"
      style={{
        left: x,
        top: y,
        backgroundColor: 'var(--ctp-surface0)',
        border: '1px solid var(--ctp-surface1)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        minWidth: 160,
      }}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separator ? (
            <div
              style={{
                height: 1,
                backgroundColor: 'var(--ctp-surface1)',
                margin: '4px 8px',
              }}
            />
          ) : (
            <button
              role="menuitem"
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors hover:bg-[var(--ctp-surface1)]"
              style={{
                color: item.danger ? 'var(--ctp-red)' : item.color ?? 'var(--ctp-text)',
              }}
              onClick={() => {
                item.onClick();
                onClose();
              }}
            >
              {item.icon && <span className="w-4 flex justify-center">{item.icon}</span>}
              {item.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}
