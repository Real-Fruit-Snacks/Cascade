import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { FolderInput, X, Folder } from 'lucide-react';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useCloseAnimation } from '../../hooks/use-close-animation';

interface MoveFileModalProps {
  open: boolean;
  fileName: string;
  folders: string[];
  currentDir: string;
  entryPath: string;
  onClose: () => void;
  onMove: (targetFolder: string) => void;
}

export function MoveFileModal({ open, fileName, folders, currentDir, entryPath, onClose, onMove }: MoveFileModalProps) {
  const { t } = useTranslation('sidebar');

  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const availableFolders = useMemo(
    () => folders.filter((f) => f !== currentDir && f !== entryPath),
    [folders, currentDir, entryPath],
  );

  const filtered = useMemo(() => {
    if (!filter) return availableFolders;
    const lower = filter.toLowerCase();
    return availableFolders.filter((f) => (f || '(root)').toLowerCase().includes(lower));
  }, [availableFolders, filter]);

  const handleSubmit = useCallback(() => {
    if (selected !== null) {
      onMove(selected);
    }
  }, [selected, onMove]);

  if (!shouldRender) return null;

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
        onKeyDown={trapKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t('modals.moveFile.ariaLabel')}
        className="flex flex-col rounded-xl overflow-hidden modal-content"
        style={{
          width: 380,
          maxHeight: 420,
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
            <FolderInput size={14} style={{ color: 'var(--ctp-accent)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-text)' }}>
              {t('modals.moveFile.title', { fileName })}
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

        {/* Filter */}
        <div className="px-4 pt-3 pb-1">
          <input
            type="text"
            placeholder={t('filters.filterFolders')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
            className="w-full px-2.5 py-1.5 rounded-md text-xs outline-none"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface1)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && selected !== null) handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>

        {/* Folder list */}
        <div
          className="flex-1 overflow-y-auto px-2 py-2"
          style={{ minHeight: 100, maxHeight: 240 }}
        >
          {filtered.length === 0 ? (
            <div className="text-xs text-center py-4" style={{ color: 'var(--ctp-overlay0)' }}>
              {t('emptyStates.noFolders')}
            </div>
          ) : (
            filtered.map((folder) => {
              const display = folder || '/ (root)';
              const isSelected = selected === folder;
              return (
                <button
                  key={folder}
                  className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-left transition-colors ${isSelected ? '' : 'hover:bg-[var(--ctp-surface0)]'}`}
                  style={{
                    backgroundColor: isSelected ? 'var(--ctp-surface1)' : undefined,
                    color: isSelected ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
                  }}
                  onClick={() => setSelected(folder)}
                  onDoubleClick={() => { setSelected(folder); onMove(folder); }}
                >
                  <Folder size={12} style={{ color: 'var(--ctp-blue)', flexShrink: 0 }} />
                  <span className="truncate">{display}</span>
                </button>
              );
            })
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
            disabled={selected === null}
            className="px-4 py-1.5 rounded-md text-xs transition-colors"
            style={{
              backgroundColor: selected !== null ? 'var(--ctp-accent)' : 'var(--ctp-surface2)',
              color: 'var(--ctp-base)',
              opacity: selected !== null ? 1 : 0.5,
            }}
          >
            {t('modals.moveFile.move')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
