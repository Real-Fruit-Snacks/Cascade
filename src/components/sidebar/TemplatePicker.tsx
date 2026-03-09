import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { FilePlus, Search, X, Folder } from 'lucide-react';
import type { FileEntry } from '../../types/index';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useCloseAnimation } from '../../hooks/use-close-animation';

export interface TemplateSelection {
  type: 'file' | 'folder';
  path: string;
}

interface TemplatePickerProps {
  open: boolean;
  templates: FileEntry[];
  folderTemplates?: FileEntry[];
  onClose: () => void;
  onSelect: (selection: TemplateSelection | null) => void;
}

export function TemplatePicker({ open, templates, folderTemplates = [], onClose, onSelect }: TemplatePickerProps) {
  const { t } = useTranslation('sidebar');

  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  const filteredFolders = useMemo(() => {
    if (!search.trim()) return folderTemplates;
    const q = search.toLowerCase();
    return folderTemplates.filter((tmpl) => tmpl.name.toLowerCase().includes(q));
  }, [folderTemplates, search]);

  if (!shouldRender) return null;

  const getDisplayName = (entry: FileEntry) =>
    entry.isDir ? entry.name : entry.name.replace(/\.md$/i, '');

  const hasResults = filteredFiles.length > 0 || filteredFolders.length > 0;

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
        aria-label={t('modals.templatePicker.title')}
        className="flex flex-col rounded-xl overflow-hidden modal-content"
        style={{
          width: 360,
          maxHeight: 480,
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
            <span style={{ color: 'var(--ctp-accent)' }}>
              <FilePlus size={14} />
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-text)' }}>
              {t('modals.templatePicker.title')}
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

        {/* Search */}
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--ctp-surface0)' }}>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
            }}
          >
            <Search size={12} style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filters.filterTemplates')}
              className="flex-1 bg-transparent outline-none placeholder:text-[var(--ctp-overlay0)]"
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
                if (e.key === 'Enter') { e.preventDefault(); onSelect(null); }
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="rounded p-0.5 hover:bg-[var(--ctp-surface1)] transition-colors"
                style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto py-1">
          {/* Blank option */}
          <button
            className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[var(--ctp-surface0)]"
            style={{ color: 'var(--ctp-subtext1)' }}
            onClick={() => onSelect(null)}
          >
            {t('modals.templatePicker.blank')}
          </button>

          {/* File templates */}
          {filteredFiles.length > 0 && (
            <>
              <div
                className="mx-3 my-1"
                style={{ borderTop: '1px solid var(--ctp-surface0)' }}
              />
              {filteredFiles.map((template) => (
                <button
                  key={template.path}
                  className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[var(--ctp-surface0)]"
                  style={{ color: 'var(--ctp-text)' }}
                  onClick={() => onSelect({ type: 'file', path: template.path })}
                >
                  {getDisplayName(template)}
                </button>
              ))}
            </>
          )}

          {/* Folder templates */}
          {filteredFolders.length > 0 && (
            <>
              <div className="mx-3 mt-2 mb-1 flex items-center gap-1">
                <div style={{ borderTop: '1px solid var(--ctp-surface0)', flex: 1 }} />
                <span className="text-[10px] px-1" style={{ color: 'var(--ctp-overlay0)' }}>
                  {t('modals.templatePicker.folderTemplates')}
                </span>
                <div style={{ borderTop: '1px solid var(--ctp-surface0)', flex: 1 }} />
              </div>
              {filteredFolders.map((template) => (
                <button
                  key={template.path}
                  className="w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[var(--ctp-surface0)] flex items-center gap-1.5"
                  style={{ color: 'var(--ctp-text)' }}
                  onClick={() => onSelect({ type: 'folder', path: template.path })}
                >
                  <Folder size={12} style={{ color: 'var(--ctp-accent)', flexShrink: 0 }} />
                  {getDisplayName(template)}
                </button>
              ))}
            </>
          )}

          {!hasResults && search && (
            <p
              className="px-4 py-3 text-xs text-center"
              style={{ color: 'var(--ctp-overlay0)' }}
            >
              {t('modals.templatePicker.noMatch', { search })}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
