import { useCallback, useEffect, useRef, useState } from 'react';
import { FilePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';

// eslint-disable-next-line no-control-regex -- intentional: reject control chars in filenames
const INVALID_CHARS = /[<>:"|?*\x00-\x1f]/;

interface NewFileModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (path: string) => void;
}

export function NewFileModal({ open, onClose, onCreate }: NewFileModalProps) {
  const { t } = useTranslation('common');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setError('');
      requestAnimationFrame(() => inputRef.current?.focus());
      setTimeout(() => { if (document.activeElement !== inputRef.current) inputRef.current?.focus(); }, 50);
    }
  }, [open]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (INVALID_CHARS.test(trimmed)) {
      setError(t('newFileModal.invalidChars'));
      return;
    }
    const path = trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`;
    onCreate(path);
    onClose();
  }, [value, onCreate, onClose]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        animation: isClosing ? 'modal-overlay-out 0.12s ease-in forwards' : 'modal-overlay-in 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="New File"
        className="flex flex-col w-full rounded-xl overflow-hidden modal-content"
        style={{
          maxWidth: '28rem',
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px color-mix(in srgb, var(--ctp-accent) 10%, transparent)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        <div
          className="flex items-center gap-3 px-4"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            borderBottom: '1px solid var(--ctp-surface1)',
          }}
        >
          <FilePlus size={16} style={{ color: 'var(--ctp-green)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="notes/my-note.md"
            className="w-full py-3.5 text-sm outline-none"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--ctp-text)',
            }}
          />
          <span
            className="text-xs px-1.5 py-0.5 rounded shrink-0"
            style={{
              color: 'var(--ctp-overlay0)',
              backgroundColor: 'var(--ctp-surface1)',
            }}
          >
            ESC
          </span>
        </div>
        <div className="px-4 py-3 text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {error ? (
            <span style={{ color: 'var(--ctp-red)' }}>{error}</span>
          ) : (
            t('newFileModal.hint')
          )}
        </div>
      </div>
    </div>
  );
}
