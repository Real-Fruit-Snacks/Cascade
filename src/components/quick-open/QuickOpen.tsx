import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, FileText, Link } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useCloseAnimation } from '../../hooks/use-close-animation';
import { useVaultStore } from '../../stores/vault-store';
import { useEditorStore } from '../../stores/editor-store';
import { useRecentFilesStore } from '../../stores/recent-files-store';
import * as cmd from '../../lib/tauri-commands';
import { fuzzyMatch } from '../../lib/fuzzy-match';
import { renderMarkdownPreview, MAX_PREVIEW_LINES } from './markdown-preview';

const PREVIEW_CACHE_MAX = 10;

export type QuickOpenMode = 'open' | 'link';

interface QuickOpenProps {
  open: boolean;
  mode?: QuickOpenMode;
  onClose: () => void;
  onInsertLink?: (name: string) => void;
}

export function QuickOpen({ open, mode = 'open', onClose, onInsertLink }: QuickOpenProps) {
  const { t } = useTranslation('commands');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [preview, setPreview] = useState('');
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);

  // LRU cache scoped to component lifecycle
  const previewCache = useRef(new Map<string, string>());
  const cachePreview = useCallback((path: string, text: string) => {
    if (previewCache.current.size >= PREVIEW_CACHE_MAX) {
      const oldest = previewCache.current.keys().next().value!;
      previewCache.current.delete(oldest);
    }
    previewCache.current.set(path, text);
  }, []);

  const flatFiles = useVaultStore((s) => s.flatFiles);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const openFile = useEditorStore((s) => s.openFile);
  const recentFiles = useRecentFilesStore((s) => s.recentFiles);
  const loadRecentFiles = useRecentFilesStore((s) => s.loadRecentFiles);

  // Load recent files from localStorage when vault is known
  useEffect(() => {
    if (vaultPath) loadRecentFiles(vaultPath);
  }, [vaultPath, loadRecentFiles]);

  const flatFilesSet = useMemo(() => new Set(flatFiles), [flatFiles]);

  // Recent files filtered to only those that still exist in the vault
  const recentResults = useMemo(
    () => recentFiles.filter((p) => flatFilesSet.has(p)).slice(0, 20),
    [recentFiles, flatFilesSet]
  );

  const isEmptyQuery = !query.trim();

  const results = useMemo(() => {
    if (isEmptyQuery) return [];
    const recentSet = new Map(recentFiles.map((p, i) => [p, i]));
    return flatFiles
      .map((f) => ({ path: f, ...fuzzyMatch(query, f) }))
      .filter((r) => r.match)
      .sort((a, b) => {
        // Boost recent files: add score bonus based on recency position
        const aIdx = recentSet.get(a.path);
        const bIdx = recentSet.get(b.path);
        const aBoost = aIdx !== undefined ? 0.5 * (1 - aIdx / recentFiles.length) : 0;
        const bBoost = bIdx !== undefined ? 0.5 * (1 - bIdx / recentFiles.length) : 0;
        return (b.score + bBoost) - (a.score + aBoost);
      })
      .slice(0, 20)
      .map((r) => r.path);
  }, [query, flatFiles, isEmptyQuery, recentFiles]);

  // Active list: recent when empty query, search results otherwise
  const activeList = isEmptyQuery ? recentResults : results;

  // Reset state when opened
  useEffect(() => {
    if (open) {
      previewCache.current.clear();
      setQuery('');
      setSelectedIndex(0);
      setPreview('');
      setPreviewPath(null);
      requestAnimationFrame(() => inputRef.current?.focus());
      setTimeout(() => { if (document.activeElement !== inputRef.current) inputRef.current?.focus(); }, 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Load preview for selected file
  useEffect(() => {
    const selectedFile = activeList[selectedIndex];
    if (!selectedFile || !vaultPath || selectedFile === previewPath) return;

    // Check cache first to avoid redundant IPC calls
    const cached = previewCache.current.get(selectedFile);
    if (cached !== undefined) {
      setPreview(cached);
      setPreviewPath(selectedFile);
      return;
    }

    let cancelled = false;
    cmd.readFile(vaultPath, selectedFile).then((text) => {
      if (cancelled) return;
      const lines = text.split('\n').slice(0, MAX_PREVIEW_LINES);
      const previewText = lines.join('\n');
      cachePreview(selectedFile, previewText);
      setPreview(previewText);
      setPreviewPath(selectedFile);
    }).catch(() => {
      if (!cancelled) {
        setPreview('');
        setPreviewPath(selectedFile);
      }
    });

    return () => { cancelled = true; };
  }, [selectedIndex, activeList, vaultPath, previewPath, cachePreview]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Account for the header element when showing recent files
    const offset = isEmptyQuery && recentResults.length > 0 ? 1 : 0;
    const item = list.children[selectedIndex + offset] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, isEmptyQuery, recentResults.length]);

  const handleSelect = useCallback(
    (path: string, newTab?: boolean) => {
      if (mode === 'link') {
        // Insert wiki-link: strip .md extension for the link name
        const name = path.replace(/\.md$/, '');
        onInsertLink?.(name);
      } else {
        if (vaultPath) {
          openFile(vaultPath, path, newTab);
        }
      }
      onClose();
    },
    [mode, vaultPath, openFile, onClose, onInsertLink]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, activeList.length - 1));
          setPreviewPath(null);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          setPreviewPath(null);
          break;
        case 'Enter':
          e.preventDefault();
          if (activeList[selectedIndex]) {
            handleSelect(activeList[selectedIndex], e.ctrlKey || e.metaKey);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [activeList, selectedIndex, handleSelect, onClose]
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
        role="dialog"
        aria-modal="true"
        aria-label={t('quickOpen.ariaLabel')}
        onKeyDown={trapKeyDown}
        className="flex flex-col w-full rounded-xl overflow-hidden modal-content"
        style={{
          maxWidth: '56rem',
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px color-mix(in srgb, var(--ctp-accent) 10%, transparent)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            borderBottom: '1px solid var(--ctp-surface1)',
          }}
        >
          {mode === 'link' ? (
            <Link size={16} style={{ color: 'var(--ctp-blue)', flexShrink: 0 }} />
          ) : (
            <FileText size={16} style={{ color: 'var(--ctp-accent)', flexShrink: 0 }} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'link' ? t('quickOpen.placeholderLink') : t('quickOpen.placeholderOpen')}
            className="w-full py-3.5 text-sm outline-none"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--ctp-text)',
            }}
          />
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              color: 'var(--ctp-overlay0)',
              backgroundColor: 'var(--ctp-surface1)',
              flexShrink: 0,
            }}
          >
            ESC
          </span>
        </div>

        {/* Results + Preview */}
        <div className="flex" style={{ height: '440px' }}>
          {/* File list */}
          <div
            ref={listRef}
            role="listbox"
            className="overflow-y-auto shrink-0"
            style={{
              width: '42%',
              borderRight: '1px solid var(--ctp-surface1)',
              backgroundColor: 'var(--ctp-mantle)',
            }}
          >
            {!isEmptyQuery && results.length === 0 && (
              <div
                className="px-4 py-8 text-sm text-center"
                style={{ color: 'var(--ctp-overlay0)' }}
              >
                {t('quickOpen.noMatchingFiles')}
              </div>
            )}
            {isEmptyQuery && recentResults.length === 0 && (
              <div
                className="px-4 py-8 text-sm text-center"
                style={{ color: 'var(--ctp-overlay0)' }}
              >
                {t('quickOpen.noRecentFiles')}
              </div>
            )}
            {isEmptyQuery && recentResults.length > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                style={{ color: 'var(--ctp-overlay1)', borderBottom: '1px solid var(--ctp-surface0)' }}
              >
                <Clock size={11} style={{ color: 'var(--ctp-accent)' }} />
                {t('quickOpen.recentHeader')}
              </div>
            )}
            {activeList.map((path, i) => {
              const parts = path.replace(/\\/g, '/').split('/');
              const name = parts.at(-1) ?? path;
              const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
              const isSelected = i === selectedIndex;

              return (
                <div
                  key={path}
                  role="option"
                  aria-selected={isSelected}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm"
                  style={{
                    backgroundColor: isSelected ? 'var(--ctp-surface0)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--ctp-accent)' : '2px solid transparent',
                    color: 'var(--ctp-text)',
                  }}
                  onClick={(e) => handleSelect(path, e.ctrlKey || e.metaKey)}
                  onMouseEnter={() => {
                    setSelectedIndex(i);
                    setPreviewPath(null);
                  }}
                >
                  <FileText
                    size={14}
                    style={{
                      color: isSelected ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)',
                      flexShrink: 0,
                    }}
                  />
                  <div className="flex flex-col truncate">
                    <span
                      className="truncate"
                      style={{
                        color: isSelected ? 'var(--ctp-text)' : 'var(--ctp-subtext1)',
                      }}
                    >
                      {name.replace(/\.md$/, '')}
                    </span>
                    {dir && (
                      <span
                        className="truncate text-xs"
                        style={{ color: 'var(--ctp-overlay0)' }}
                      >
                        {dir}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preview pane */}
          <div
            className="flex-1 overflow-y-auto p-5 text-xs leading-relaxed"
            style={{
              color: 'var(--ctp-subtext0)',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              wordBreak: 'break-word',
              backgroundColor: 'var(--ctp-base)',
            }}
          >
            {preview ? (
              renderMarkdownPreview(preview)
            ) : (
              <span style={{ color: 'var(--ctp-overlay0)', fontStyle: 'italic' }}>
                {activeList.length > 0 ? t('quickOpen.loadingPreview') : t('quickOpen.noFileSelected')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
