import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  kind?: 'info' | 'warning';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  kind = 'info',
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!shouldRender) return null;

  const Icon = kind === 'warning' ? AlertTriangle : Info;
  const iconColor = kind === 'warning' ? 'var(--ctp-yellow)' : 'var(--ctp-blue)';
  const confirmColor = kind === 'warning' ? 'var(--ctp-red)' : 'var(--ctp-accent)';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        animation: isClosing ? 'modal-overlay-out 0.12s ease-in forwards' : 'modal-overlay-in 0.15s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex flex-col rounded-xl overflow-hidden modal-content"
        style={{
          width: 380,
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        {/* Body */}
        <div className="flex gap-3 px-5 py-5">
          <div
            className="flex items-center justify-center shrink-0 rounded-full"
            style={{ width: 36, height: 36, backgroundColor: 'var(--ctp-surface0)' }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-sm font-semibold" style={{ color: 'var(--ctp-text)' }}>
              {title}
            </span>
            <span className="text-xs leading-relaxed" style={{ color: 'var(--ctp-subtext0)' }}>
              {message}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--ctp-surface0)' }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md text-xs transition-colors hover:brightness-125"
            style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-text)' }}
          >
            {cancelLabel ?? t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-md text-xs transition-colors hover:opacity-90"
            style={{ backgroundColor: confirmColor, color: 'var(--ctp-base)' }}
          >
            {confirmLabel ?? t('confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
