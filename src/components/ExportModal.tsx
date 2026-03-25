import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, X } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useToastStore } from '../stores/toast-store';
import { exportFile, exportBinary } from '../lib/tauri-commands';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { markdownToHtml, buildHtmlDocument, markdownToDocx, performBatchExport, type BatchFormat } from '../lib/export-utils';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  defaultScope?: 'current' | 'vault';
}

type ExportFormat = 'html' | 'pdf' | 'markdown' | 'docx';

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  html: 'html',
  pdf: 'html',
  markdown: 'md',
  docx: 'docx',
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  html: 'HTML',
  pdf: 'Styled HTML',
  markdown: 'Markdown',
  docx: 'Word Document',
};

export function ExportModal({ open, onClose, defaultScope }: ExportModalProps) {
  const { t } = useTranslation('export');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('html');
  const [batchFormat, setBatchFormat] = useState<BatchFormat>('html-themed');
  const [includeImages, setIncludeImages] = useState(true);
  const [resolveWikiLinks, setResolveWikiLinks] = useState(true);
  const [tagFilter, setTagFilter] = useState('');
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const content = useEditorStore((s) => s.content);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [scope, setScope] = useState<'current' | 'vault' | 'folder' | 'tag'>('current');
  const [selectedFolder, setSelectedFolder] = useState('');
  const fileTree = useVaultStore((s) => s.fileTree);
  const flatFiles = useVaultStore((s) => s.flatFiles);
  const tagIndex = useVaultStore((s) => s.tagIndex);

  const folders = useMemo(() => {
    if (!fileTree) return [];
    const result: string[] = [];
    const walk = (entries: typeof fileTree, prefix: string) => {
      for (const entry of entries) {
        if (entry.isDir) {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          result.push(path);
          if (entry.children) walk(entry.children, path);
        }
      }
    };
    walk(fileTree, '');
    return result;
  }, [fileTree]);

  const fileName = activeFilePath?.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') ?? 'export';

  useEffect(() => {
    if (open) {
      setScope(defaultScope ?? 'current');
    }
  }, [open, defaultScope]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (scope === 'current' && format !== 'html' && format !== 'markdown' && format !== 'pdf' && format !== 'docx') {
      setFormat('html');
    }
  }, [scope, format]);

  const handleExport = useCallback(async () => {
    if (!vaultPath) return;
    setExporting(true);
    try {
      // Batch export (vault, folder, or tag)
      if (scope !== 'current') {
        let exportFiles: string[];
        if (scope === 'vault') {
          exportFiles = flatFiles.filter((f) => /\.md$/i.test(f));
        } else if (scope === 'folder') {
          if (!selectedFolder) {
            useToastStore.getState().addToast(t('toast.selectFolder'), 'error');
            setExporting(false);
            return;
          }
          const folderPrefix = selectedFolder.replace(/\\/g, '/');
          exportFiles = flatFiles.filter((f) => {
            const normalized = f.replace(/\\/g, '/');
            return normalized.startsWith(folderPrefix + '/') && /\.md$/i.test(f);
          });
        } else {
          const tag = tagFilter.replace(/^#/, '').trim();
          if (!tag) {
            useToastStore.getState().addToast(t('toast.enterTag'), 'error');
            setExporting(false);
            return;
          }
          const tagFiles = tagIndex.get(tag);
          if (!tagFiles || tagFiles.size === 0) {
            useToastStore.getState().addToast(t('toast.noFilesForTag', { tag }), 'error');
            setExporting(false);
            return;
          }
          exportFiles = Array.from(tagFiles);
        }

        if (exportFiles.length === 0) {
          useToastStore.getState().addToast(t('toast.noFilesToExport'), 'error');
          setExporting(false);
          return;
        }

        const defaultName = scope === 'vault' ? 'vault-export' : scope === 'folder' ? selectedFolder : `tag-${tagFilter.replace(/^#/, '')}`;
        const savePath = await save({
          defaultPath: `${defaultName}.zip`,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        });
        if (!savePath) { setExporting(false); return; }

        abortRef.current = { aborted: false };
        setExportProgress({ current: 0, total: exportFiles.length });

        try {
          const count = await performBatchExport({
            vaultPath: vaultPath!,
            files: exportFiles,
            format: batchFormat,
            includeImages: batchFormat !== 'markdown' && includeImages,
            resolveWikiLinks: batchFormat !== 'markdown' && resolveWikiLinks,
            outputPath: savePath,
            onProgress: (current, total) => setExportProgress({ current, total }),
            abortSignal: abortRef.current,
          });
          if (!abortRef.current.aborted) {
            useToastStore.getState().addToast(t('toast.exportedFiles', { count }), 'success');
          }
        } finally {
          setExportProgress(null);
          setExporting(false);
          if (!abortRef.current.aborted) onClose();
        }
        return;
      }

      if (!activeFilePath) return;
      const ext = FORMAT_EXTENSIONS[format];
      const savePath = await save({
        defaultPath: `${fileName}.${ext}`,
        filters: [{ name: FORMAT_LABELS[format], extensions: [ext] }],
      });
      if (!savePath) { setExporting(false); return; }

      if (format === 'markdown') {
        await exportFile(vaultPath, savePath, content);
      } else if (format === 'html') {
        const bodyHtml = markdownToHtml(content);
        const fullHtml = buildHtmlDocument(fileName, bodyHtml);
        await exportFile(vaultPath, savePath, fullHtml);
      } else if (format === 'pdf') {
        // Export as styled HTML (true PDF generation requires external tooling)
        const bodyHtml = markdownToHtml(content);
        const fullHtml = buildHtmlDocument(fileName, bodyHtml);
        await exportFile(vaultPath, savePath, fullHtml);
      } else if (format === 'docx') {
        const blob = await markdownToDocx(content, fileName);
        const arrayBuf = await blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuf));
        await exportBinary(savePath, bytes);
      }

      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      useToastStore.getState().addToast(t('toast.exportFailed', { message: msg }), 'error');
    } finally {
      setExporting(false);
    }
  }, [activeFilePath, vaultPath, content, fileName, onClose, format, scope, selectedFolder, flatFiles, tagIndex, batchFormat, includeImages, resolveWikiLinks, tagFilter, t]);

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
        aria-label={t('dialogAriaLabel')}
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
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--ctp-surface0)' }}
        >
          <div className="flex items-center gap-2">
            <FileDown size={16} style={{ color: 'var(--ctp-accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
              {scope === 'current' ? t('title.current') : scope === 'vault' ? t('title.vault') : scope === 'folder' ? t('title.folder') : t('title.tag')}
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

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          {scope === 'current' ? (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.file')}</span>
              <span className="text-sm" style={{ color: 'var(--ctp-subtext0)' }}>
                {fileName}.md
              </span>
            </div>
          ) : null}

          {/* Export Scope */}
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.scope')}</span>
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as 'current' | 'vault' | 'folder' | 'tag');
                if (e.target.value !== 'folder') setSelectedFolder('');
                if (e.target.value !== 'tag') setTagFilter('');
              }}
              className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--ctp-surface0)',
                color: 'var(--ctp-subtext1)',
                border: '1px solid var(--ctp-surface1)',
              }}
            >
              <option value="current">{t('scope.current')}</option>
              <option value="vault">{t('scope.vault')}</option>
              <option value="folder">{t('scope.folder')}</option>
              <option value="tag">{t('scope.tag')}</option>
            </select>
          </div>

          {/* Folder selector - only shown when scope is 'folder' */}
          {scope === 'folder' && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.folder')}</span>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-subtext1)',
                  border: '1px solid var(--ctp-surface1)',
                }}
              >
                <option value="">{t('folder.selectPlaceholder')}</option>
                {folders.map((f: string) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}

          {scope === 'tag' && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.tag')}</span>
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder={t('tag.placeholder')}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-subtext1)',
                  border: '1px solid var(--ctp-surface1)',
                  width: 160,
                }}
              />
            </div>
          )}

          {scope === 'current' ? (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.format')}</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-subtext1)',
                  border: '1px solid var(--ctp-surface1)',
                }}
              >
                <option value="html">{t('format.html')}</option>
                <option value="pdf">{t('format.pdf')}</option>
                <option value="markdown">{t('format.markdown')}</option>
                <option value="docx">{t('format.docx')}</option>
              </select>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('labels.format')}</span>
                <select
                  value={batchFormat}
                  onChange={(e) => setBatchFormat(e.target.value as BatchFormat)}
                  className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--ctp-surface0)',
                    color: 'var(--ctp-subtext1)',
                    border: '1px solid var(--ctp-surface1)',
                  }}
                >
                  <option value="html-themed">{t('format.htmlThemed')}</option>
                  <option value="html-minimal">{t('format.htmlMinimal')}</option>
                  <option value="markdown">{t('format.markdown')}</option>
                </select>
              </div>

              {batchFormat !== 'markdown' && (
                <>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('options.includeImages')}</span>
                    <input
                      type="checkbox"
                      checked={includeImages}
                      onChange={(e) => setIncludeImages(e.target.checked)}
                      className="accent-[var(--ctp-accent)]"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{t('options.resolveWikiLinks')}</span>
                    <input
                      type="checkbox"
                      checked={resolveWikiLinks}
                      onChange={(e) => setResolveWikiLinks(e.target.checked)}
                      className="accent-[var(--ctp-accent)]"
                    />
                  </label>
                </>
              )}
            </>
          )}
        </div>

        {/* Progress bar */}
        {exportProgress && (
          <div className="px-5 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
                {t('progress.exporting', { current: exportProgress.current, total: exportProgress.total })}
              </span>
              <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
                {exportProgress.total > 0 ? Math.round((exportProgress.current / exportProgress.total) * 100) : 0}%
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 4, backgroundColor: 'var(--ctp-surface0)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%`,
                  backgroundColor: 'var(--ctp-accent)',
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid var(--ctp-surface0)' }}
        >
          <button
            onClick={() => {
              if (exportProgress) {
                abortRef.current.aborted = true;
                setExportProgress(null);
                setExporting(false);
              } else {
                onClose();
              }
            }}
            className="px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--ctp-surface1)]"
            style={{ color: 'var(--ctp-subtext0)' }}
          >
            {exportProgress ? t('buttons.cancelExport') : t('common:cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={(scope === 'current' && !activeFilePath) || exporting}
            className="px-4 py-1.5 rounded-md text-xs transition-colors"
            style={{
              backgroundColor: (scope !== 'current' || activeFilePath) ? 'var(--ctp-accent)' : 'var(--ctp-surface2)',
              color: 'var(--ctp-base)',
              opacity: exporting ? 0.5 : 1,
            }}
          >
            {exporting ? t('buttons.exporting') : t('common:export')}
          </button>
        </div>
      </div>
    </div>
  );
}
