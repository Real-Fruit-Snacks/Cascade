import { useEffect, useMemo, useRef } from 'react';
import { X, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { extractTags } from '../lib/tag-utils';

interface FilePropertiesDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatDate(ts: number | undefined): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

export function FilePropertiesDialog({ open, onClose }: FilePropertiesDialogProps) {
  const { t } = useTranslation('dialogs');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);

  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const content = useEditorStore((s) => {
    const tab = s.tabs[s.activeTabIndex];
    return tab?.content ?? '';
  });
  const fileTree = useVaultStore((s) => s.fileTree);
  const backlinkIndex = useVaultStore((s) => s.backlinkIndex);

  // Find the FileEntry for modified date
  const fileEntry = useMemo(() => {
    if (!activeFilePath) return null;
    const find = (entries: typeof fileTree): typeof fileTree[0] | null => {
      for (const e of entries) {
        if (e.path === activeFilePath) return e;
        if (e.children) {
          const found = find(e.children);
          if (found) return found;
        }
      }
      return null;
    };
    return find(fileTree);
  }, [activeFilePath, fileTree]);

  const stats = useMemo(() => {
    if (!content) return { words: 0, chars: 0, lines: 0, paragraphs: 0 };
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;
    const lines = content.split('\n').length;
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim()).length;
    return { words, chars, lines, paragraphs };
  }, [content]);

  const tags = useMemo(() => {
    if (!content) return [];
    return [...extractTags(content)].sort();
  }, [content]);

  const backlinkCount = useMemo(() => {
    if (!activeFilePath) return 0;
    const name = activeFilePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '')?.toLowerCase() ?? '';
    return backlinkIndex.get(name)?.size ?? 0;
  }, [activeFilePath, backlinkIndex]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!shouldRender || !activeFilePath) return null;

  const fileName = activeFilePath.replace(/\\/g, '/').split('/').pop() ?? activeFilePath;

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
        role="dialog"
        aria-modal="true"
        aria-label={t('fileProperties.title')}
        onKeyDown={trapKeyDown}
        className="flex flex-col rounded-xl overflow-hidden modal-content"
        style={{
          width: 400,
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
            <FileText size={16} style={{ color: 'var(--ctp-accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
              {t('fileProperties.title')}
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

        {/* Content */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <PropRow label={t('fileProperties.name')} value={fileName} />
          <PropRow label={t('fileProperties.path')} value={activeFilePath.replace(/\\/g, '/')} mono />
          <PropRow label={t('fileProperties.modified')} value={formatDate(fileEntry?.modified)} />

          <div style={{ height: 1, backgroundColor: 'var(--ctp-surface0)', margin: '2px 0' }} />

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <PropRow label={t('fileProperties.words')} value={stats.words.toLocaleString()} />
            <PropRow label={t('fileProperties.characters')} value={stats.chars.toLocaleString()} />
            <PropRow label={t('fileProperties.lines')} value={stats.lines.toLocaleString()} />
            <PropRow label={t('fileProperties.paragraphs')} value={stats.paragraphs.toLocaleString()} />
          </div>

          <div style={{ height: 1, backgroundColor: 'var(--ctp-surface0)', margin: '2px 0' }} />

          <PropRow label={t('fileProperties.backlinks')} value={backlinkCount.toString()} />
          {tags.length > 0 && (
            <div>
              <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{t('fileProperties.tags')}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--ctp-surface0)',
                      color: 'var(--ctp-accent)',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end px-4 py-2.5"
          style={{ borderTop: '1px solid var(--ctp-surface0)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs transition-colors"
            style={{
              backgroundColor: 'var(--ctp-accent)',
              color: 'var(--ctp-base)',
            }}
          >
            {t('common:close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PropRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs shrink-0" style={{ color: 'var(--ctp-subtext0)' }}>{label}</span>
      <span
        className={`text-xs text-right truncate ${mono ? 'font-mono' : ''}`}
        style={{ color: 'var(--ctp-text)', maxWidth: '70%' }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
