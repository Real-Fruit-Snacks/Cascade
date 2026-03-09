import { useEffect, useRef, useState } from 'react';
import { X, FileText } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { t } = useTranslation('dialogs');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const [version, setVersion] = useState<string>('...');
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      getVersion().then(setVersion).catch(() => setVersion('0.1.0'));
    }
  }, [open]);

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
        aria-label={t('about.title')}
        className="flex flex-col rounded-xl overflow-hidden modal-content"
        style={{
          width: 320,
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
          <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
            {t('about.title')}
          </span>
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
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{
              width: 56,
              height: 56,
              backgroundColor: 'var(--ctp-surface0)',
              border: '1px solid var(--ctp-surface1)',
            }}
          >
            <FileText size={28} style={{ color: 'var(--ctp-mauve)' }} />
          </div>

          <div className="flex flex-col items-center gap-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ctp-text)' }}>
              {t('common:appName')}
            </h2>
            <span className="text-xs" style={{ color: 'var(--ctp-overlay1)' }}>
              {t('common:version', { version })}
            </span>
          </div>

          <div
            className="w-full rounded-lg px-4 py-3 text-xs flex flex-col gap-1.5"
            style={{
              backgroundColor: 'var(--ctp-base)',
              border: '1px solid var(--ctp-surface0)',
              color: 'var(--ctp-subtext0)',
            }}
          >
            <div className="flex justify-between">
              <span style={{ color: 'var(--ctp-overlay1)' }}>{t('about.builtWith')}</span>
              <span>{t('about.builtWithValue')}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--ctp-overlay1)' }}>{t('about.theme')}</span>
              <span>{t('about.themeValue')}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--ctp-overlay1)' }}>{t('about.madeBy')}</span>
              <span>{t('about.madeByValue')}</span>
            </div>
          </div>
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
            {t('common:close')}
          </button>
        </div>
      </div>
    </div>
  );
}
