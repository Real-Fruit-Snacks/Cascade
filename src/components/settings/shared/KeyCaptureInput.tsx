import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

export interface KeyCaptureInputProps {
  capturedKey: string;
  onKeyCapture: (e: KeyboardEvent) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function KeyCaptureInput({ capturedKey, onKeyCapture, onSave, onCancel }: KeyCaptureInputProps) {
  const { t: ts } = useTranslation('settings');
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.addEventListener('keydown', onKeyCapture);
    return () => el.removeEventListener('keydown', onKeyCapture);
  }, [onKeyCapture]);

  return (
    <div className="flex items-center gap-1">
      <div
        ref={inputRef}
        tabIndex={0}
        className="rounded px-2 py-0.5 text-xs outline-none"
        style={{
          backgroundColor: 'var(--ctp-surface0)',
          border: '1px solid var(--ctp-accent)',
          color: capturedKey ? 'var(--ctp-text)' : 'var(--ctp-overlay0)',
          fontFamily: 'monospace',
          minWidth: 80,
          textAlign: 'center',
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        {capturedKey || ts('shortcuts.pressKeys')}
      </div>
      {capturedKey && (
        <button
          onClick={onSave}
          className="rounded px-1.5 py-0.5 text-xs transition-colors"
          style={{ backgroundColor: 'var(--ctp-accent)', color: 'var(--ctp-base)' }}
        >
          {ts('shortcuts.save')}
        </button>
      )}
      <button
        onClick={onCancel}
        className="flex items-center justify-center rounded transition-colors hover:bg-[var(--ctp-surface1)]"
        style={{ width: 20, height: 20, color: 'var(--ctp-overlay1)' }}
        title={ts('shortcuts.cancel')}
      >
        <X size={11} />
      </button>
    </div>
  );
}
