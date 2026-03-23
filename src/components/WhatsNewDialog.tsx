import { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { RenderedMarkdown } from './settings/marketplace/RenderedMarkdown';

interface WhatsNewDialogProps {
  open: boolean;
  onClose: () => void;
  version: string;
  releaseNotes: string;
}

export function WhatsNewDialog({ open, onClose, version, releaseNotes }: WhatsNewDialogProps) {
  const { t } = useTranslation('dialogs');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!shouldRender) return null;

  return (
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
        onKeyDown={trapKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t('whatsNew.title', { version })}
        className="flex flex-col rounded-xl overflow-hidden modal-content"
        style={{
          width: 480,
          maxHeight: '70vh',
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--ctp-surface0)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: 'var(--ctp-mauve)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
              {t('whatsNew.title', { version })}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common:close')}
            className="flex items-center justify-center rounded transition-colors hover:bg-[var(--ctp-surface1)]"
            style={{ width: 22, height: 22, color: 'var(--ctp-overlay1)' }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{ overscrollBehavior: 'contain' }}
        >
          <RenderedMarkdown content={releaseNotes} />
        </div>

        {/* Footer */}
        <div
          className="flex justify-end px-4 py-3"
          style={{ borderTop: '1px solid var(--ctp-surface0)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--ctp-mauve)', color: 'var(--ctp-base)' }}
          >
            {t('whatsNew.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
}
