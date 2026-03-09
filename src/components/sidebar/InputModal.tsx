import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useCloseAnimation } from '../../hooks/use-close-animation';

interface InputModalProps {
  open: boolean;
  title: string;
  icon?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  /** Return an error string if invalid, or null if OK */
  validate?: (value: string) => string | null;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export function InputModal({
  open,
  title,
  icon,
  placeholder,
  defaultValue = '',
  submitLabel,
  validate,
  onClose,
  onSubmit,
}: InputModalProps) {
  const { t } = useTranslation('sidebar');

  const { shouldRender, isClosing } = useCloseAnimation(open);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);

  // Use provided submitLabel or fall back to 'Create'
  const resolvedSubmitLabel = submitLabel ?? t('modals.newFile.submitLabel');

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setError(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, defaultValue]);

  if (!shouldRender) return null;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (validate) {
      const err = validate(trimmed);
      if (err) { setError(err); return; }
    }
    onSubmit(trimmed);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        animation: isClosing ? 'modal-overlay-out 0.12s ease-in forwards' : 'modal-overlay-in 0.15s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={trapKeyDown}
        className="flex flex-col rounded-xl overflow-hidden modal-content"
        style={{
          width: 360,
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid var(--ctp-surface0)' }}
        >
          <div className="flex items-center gap-2">
            {icon && <span style={{ color: 'var(--ctp-accent)' }}>{icon}</span>}
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-text)' }}>
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-[var(--ctp-surface0)]"
            style={{ color: 'var(--ctp-overlay1)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Input */}
        <div className="px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            placeholder={placeholder}
            className="w-full px-2.5 py-1.5 rounded-md text-xs outline-none"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: `1px solid ${error ? 'var(--ctp-red)' : 'var(--ctp-surface1)'}`,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
          />
          {error && (
            <span className="text-xs mt-1" style={{ color: 'var(--ctp-red)' }}>{error}</span>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-2.5"
          style={{ borderTop: '1px solid var(--ctp-surface0)' }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--ctp-surface1)]"
            style={{ color: 'var(--ctp-subtext0)' }}
          >
            {t('common:cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-4 py-1.5 rounded-md text-xs transition-colors"
            style={{
              backgroundColor: value.trim() ? 'var(--ctp-accent)' : 'var(--ctp-surface2)',
              color: 'var(--ctp-base)',
              opacity: value.trim() ? 1 : 0.5,
            }}
          >
            {resolvedSubmitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
