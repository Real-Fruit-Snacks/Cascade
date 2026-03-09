import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { useSettingsStore } from '../stores/settings-store';
import { useEditorStore } from '../stores/editor-store';

const SIDEBAR_WIDTH_KEY = 'cascade-sidebar-width';
const SIDEBAR_VISIBLE_KEY = 'cascade-sidebar-visible';
const DEFAULT_SIDEBAR_WIDTH = 260;

interface SetVariableModalProps {
  open: boolean;
  variableName: string;
  currentValue: string;
  onClose: () => void;
  onSave: (value: string) => void;
}

export function SetVariableModal({ open, variableName, currentValue, onClose, onSave }: SetVariableModalProps) {
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [_viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  const sidebarPosition = useSettingsStore((s) => s.sidebarPosition);
  const focusModeActive = useEditorStore((s) => s.focusModeActive);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    if (open) {
      setValue(currentValue);
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, currentValue]);

  const handleSubmit = useCallback(() => {
    onSave(value);
    onClose();
  }, [value, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleSubmit, onClose]
  );

  if (!shouldRender) return null;

  // Calculate sidebar offset for editor-pane centering
  // Activity bar (40px) is always visible unless in focus mode
  const ACTIVITY_BAR_WIDTH = 40;
  const panelVisible = !focusModeActive && localStorage.getItem(SIDEBAR_VISIBLE_KEY) !== 'false';
  const sidebarWidth = focusModeActive
    ? 0
    : panelVisible
      ? parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || String(DEFAULT_SIDEBAR_WIDTH), 10)
      : ACTIVITY_BAR_WIDTH;

  const leftInset = sidebarPosition === 'right' ? 0 : sidebarWidth;
  const rightInset = sidebarPosition === 'right' ? sidebarWidth : 0;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          animation: isClosing ? 'modal-overlay-out 0.12s ease-in forwards' : 'modal-overlay-in 0.15s ease-out',
        }}
        onClick={onClose}
      />
      {/* Dialog — centered via inset + margin:auto (no transform needed) */}
      <div
        ref={dialogRef}
        onKeyDown={trapKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Set Variable"
        style={{
          position: 'fixed',
          zIndex: 50,
          top: 0,
          bottom: 0,
          left: leftInset,
          right: rightInset,
          margin: 'auto',
          width: '28rem',
          maxWidth: 'calc(100vw - 2rem)',
          height: 'fit-content',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px color-mix(in srgb, var(--ctp-accent) 10%, transparent)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0 1rem',
            backgroundColor: 'var(--ctp-surface0)',
            borderBottom: '1px solid var(--ctp-surface1)',
          }}
        >
          <Pencil size={16} style={{ color: 'var(--ctp-green)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter value..."
            style={{
              width: '100%',
              padding: '0.875rem 0',
              fontSize: '0.875rem',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--ctp-text)',
              border: 'none',
            }}
          />
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              flexShrink: 0,
              color: 'var(--ctp-overlay0)',
              backgroundColor: 'var(--ctp-surface1)',
            }}
          >
            ESC
          </span>
        </div>
        <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--ctp-overlay0)' }}>
            Set value for <span style={{ color: 'var(--ctp-accent)' }}>{variableName}</span>
          </span>
          <button
            onClick={handleSubmit}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '0.375rem',
              backgroundColor: 'var(--ctp-accent)',
              color: 'var(--ctp-base)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
