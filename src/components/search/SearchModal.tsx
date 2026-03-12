import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, FileText, Replace, Search } from 'lucide-react';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useCloseAnimation } from '../../hooks/use-close-animation';
import { useVaultStore } from '../../stores/vault-store';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore } from '../../stores/settings-store';
import * as cmd from '../../lib/tauri-commands';
import type { SearchMatch, ReplaceResult } from '../../lib/tauri-commands';
import { showConfirm } from '../../stores/confirm-store';
import { highlightQuery, parseSearchScope, filterByScope, groupByFile, type FileGroup } from './search-utils';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const { t } = useTranslation('search');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceText, setReplaceText] = useState('');
  const [replaceStatus, setReplaceStatus] = useState('');
  const [useRegex, setUseRegex] = useState(() => useSettingsStore.getState().searchRegex);
  const [caseSensitive, setCaseSensitive] = useState(() => useSettingsStore.getState().searchCaseSensitive);
  const [wholeWord, setWholeWord] = useState(() => useSettingsStore.getState().searchWholeWord);
  const [regexError, setRegexError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);

  const vaultPath = useVaultStore((s) => s.vaultPath);
  const tagIndex = useVaultStore((s) => s.tagIndex);
  const openFile = useEditorStore((s) => s.openFile);

  const groups = useMemo(() => groupByFile(results), [results]);
  const selectedGroup = groups[selectedIndex] ?? null;

  // Focus input on open (but preserve previous search state)
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
      setTimeout(() => { if (document.activeElement !== inputRef.current) inputRef.current?.focus(); }, 50);
    }
  }, [open]);

  // Listen for cascade:open-search-replace event
  useEffect(() => {
    const handler = () => {
      setReplaceMode(true);
      requestAnimationFrame(() => replaceInputRef.current?.focus());
      setTimeout(() => { if (document.activeElement !== replaceInputRef.current) replaceInputRef.current?.focus(); }, 50);
    };
    window.addEventListener('cascade:open-search-replace', handler);
    return () => window.removeEventListener('cascade:open-search-replace', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || !vaultPath) {
      setResults([]);
      setLoading(false);
      setRegexError('');
      return;
    }

    setLoading(true);
    const seq = ++searchSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const scope = parseSearchScope(query.trim());
        const searchText = scope.textQuery || (scope.tags.length > 0 || scope.paths.length > 0 || scope.properties.length > 0 ? '' : query.trim());
        let matches: SearchMatch[];
        if (searchText) {
          matches = await cmd.searchVault(vaultPath, searchText, useRegex, caseSensitive, wholeWord);
        } else {
          // Scope-only query: use existing file list instead of full vault scan
          const flatFiles = useVaultStore.getState().flatFiles;
          matches = flatFiles
            .filter((f) => f.endsWith('.md'))
            .map((f) => ({ filePath: f, lineNumber: 0, lineText: '', matchStart: 0, matchEnd: 0 }));
        }
        if (seq !== searchSeqRef.current) return;
        matches = filterByScope(matches, scope, tagIndex);
        setResults(matches);
        setSelectedIndex(0);
        setRegexError('');
      } catch (e) {
        if (seq !== searchSeqRef.current) return;
        const msg = String(e);
        if (useRegex && msg.includes('Invalid regex')) {
          setRegexError(msg.replace('Invalid regex: ', ''));
        }
        setResults([]);
      } finally {
        if (seq === searchSeqRef.current) setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, vaultPath, useRegex, caseSensitive, wholeWord, tagIndex]);

  // Scroll selected file into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const runSearch = useCallback(async () => {
    if (!query.trim() || !vaultPath) {
      setResults([]);
      return;
    }
    try {
      const scope = parseSearchScope(query.trim());
      const searchText = scope.textQuery || (scope.tags.length > 0 || scope.paths.length > 0 || scope.properties.length > 0 ? '' : query.trim());
      let matches: SearchMatch[];
      if (searchText) {
        matches = await cmd.searchVault(vaultPath, searchText, useRegex, caseSensitive, wholeWord);
      } else {
        matches = await cmd.searchVault(vaultPath, '.', true, false, false);
      }
      matches = filterByScope(matches, scope, tagIndex);
      setResults(matches);
      setSelectedIndex(0);
      setRegexError('');
    } catch (e) {
      const msg = String(e);
      if (useRegex && msg.includes('Invalid regex')) {
        setRegexError(msg.replace('Invalid regex: ', ''));
      }
      setResults([]);
    }
  }, [query, vaultPath, useRegex, caseSensitive, wholeWord, tagIndex]);

  const reloadAffectedTabs = useCallback(
    async (affectedPaths: string[]) => {
      if (!vaultPath || affectedPaths.length === 0) return;
      for (const filePath of affectedPaths) {
        try {
          // Re-read tabs each iteration since indices shift after closeTab
          const { tabs, closeTab } = useEditorStore.getState();
          const tabIndex = tabs.findIndex((t) => t.path === filePath);
          if (tabIndex !== -1) {
            closeTab(tabIndex, true);
            await openFile(vaultPath, filePath);
          }
        } catch { /* continue to next tab */ }
      }
    },
    [vaultPath, openFile]
  );

  const handleReplace = useCallback(
    async (allFiles: boolean) => {
      if (!vaultPath || !query.trim()) return;
      const filePaths = allFiles
        ? groups.map((g) => g.filePath)
        : selectedGroup
          ? [selectedGroup.filePath]
          : [];
      if (filePaths.length === 0) return;

      if (allFiles && filePaths.length > 1) {
        const confirmed = await showConfirm({
          title: t('replace.confirmTitle', 'Replace All'),
          message: t('replace.confirmAll', { files: filePaths.length }),
          kind: 'warning',
          confirmLabel: t('replace.confirmLabel', 'Replace'),
        });
        if (!confirmed) return;
      }

      try {
        const result: ReplaceResult = await cmd.replaceInFiles(
          vaultPath,
          query.trim(),
          replaceText,
          filePaths,
          useRegex,
          caseSensitive,
          wholeWord,
        );
        setReplaceStatus(
          t('replace.success' + (result.filesChanged !== 1 ? '_plural' : ''), { replacements: result.totalReplacements, files: result.filesChanged })
        );
        setTimeout(() => setReplaceStatus(''), 3000);
        useVaultStore.getState().refreshTree();
        await runSearch();
        await reloadAffectedTabs(filePaths);
      } catch (e) {
        setReplaceStatus(t('replace.failed'));
        setTimeout(() => setReplaceStatus(''), 3000);
      }
    },
    [vaultPath, query, replaceText, groups, selectedGroup, runSearch, reloadAffectedTabs, useRegex, caseSensitive, wholeWord, t]
  );

  const handleSelect = useCallback(
    (group: FileGroup, newTab?: boolean, lineNumber?: number) => {
      if (vaultPath) {
        const line = lineNumber ?? group.matches[0]?.lineNumber ?? null;
        if (line !== null) {
          useEditorStore.setState({ pendingScrollLine: line });
        }
        openFile(vaultPath, group.filePath, newTab);
      }
      onClose();
    },
    [vaultPath, openFile, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, groups.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (groups[selectedIndex]) {
            handleSelect(groups[selectedIndex], e.ctrlKey || e.metaKey);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [groups, selectedIndex, handleSelect, onClose]
  );

  const handleReplaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handleReplace(true);
        } else {
          handleReplace(false);
        }
      }
    },
    [handleReplace, onClose]
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
        aria-label={t('common:search')}
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
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            borderBottom: '1px solid var(--ctp-surface1)',
          }}
        >
          <div className="flex items-center gap-3 px-4">
            <button
              onClick={() => setReplaceMode((v) => !v)}
              className="shrink-0 p-0.5 rounded hover:bg-[var(--ctp-surface1)] transition-colors"
              style={{ color: 'var(--ctp-overlay1)' }}
              title={replaceMode ? t('toggleReplace.collapse') : t('toggleReplace.expand')}
            >
              {replaceMode
                ? <ChevronDown size={14} />
                : <ChevronRight size={14} />}
            </button>
            <Search size={16} style={{ color: 'var(--ctp-green)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('placeholder')}
              className="w-full py-3.5 text-sm outline-none"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--ctp-text)',
              }}
            />
            <div className="flex items-center gap-2 shrink-0">
              {loading && (
                <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
                  {t('loading')}
                </span>
              )}
              {!loading && regexError && (
                <span className="text-xs" style={{ color: 'var(--ctp-red)' }} title={regexError}>
                  {t('invalidRegex')}
                </span>
              )}
              {!loading && !regexError && groups.length > 0 && (
                <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
                  {t('matchCount', { count: results.length, files: groups.length })}
                </span>
              )}
              {/* Regex toggle */}
              <button
                onClick={() => {
                  const next = !useRegex;
                  setUseRegex(next);
                  useSettingsStore.getState().update({ searchRegex: next });
                }}
                title={t('toggles.regex')}
                className="text-xs px-1.5 py-0.5 rounded font-mono transition-colors"
                style={{
                  backgroundColor: useRegex ? 'var(--ctp-mauve)' : 'var(--ctp-surface0)',
                  color: useRegex ? 'var(--ctp-base)' : 'var(--ctp-overlay1)',
                  border: '1px solid ' + (useRegex ? 'var(--ctp-mauve)' : 'var(--ctp-surface2)'),
                }}
              >
                .*
              </button>
              {/* Case-sensitive toggle */}
              <button
                onClick={() => {
                  const next = !caseSensitive;
                  setCaseSensitive(next);
                  useSettingsStore.getState().update({ searchCaseSensitive: next });
                }}
                title={t('toggles.matchCase')}
                className="text-xs px-1.5 py-0.5 rounded transition-colors"
                style={{
                  backgroundColor: caseSensitive ? 'var(--ctp-mauve)' : 'var(--ctp-surface0)',
                  color: caseSensitive ? 'var(--ctp-base)' : 'var(--ctp-overlay1)',
                  border: '1px solid ' + (caseSensitive ? 'var(--ctp-mauve)' : 'var(--ctp-surface2)'),
                }}
              >
                Aa
              </button>
              {/* Whole word toggle */}
              <button
                onClick={() => {
                  const next = !wholeWord;
                  setWholeWord(next);
                  useSettingsStore.getState().update({ searchWholeWord: next });
                }}
                title={t('toggles.wholeWord')}
                className="text-xs px-1.5 py-0.5 rounded font-mono transition-colors"
                style={{
                  backgroundColor: wholeWord ? 'var(--ctp-mauve)' : 'var(--ctp-surface0)',
                  color: wholeWord ? 'var(--ctp-base)' : 'var(--ctp-overlay1)',
                  border: '1px solid ' + (wholeWord ? 'var(--ctp-mauve)' : 'var(--ctp-surface2)'),
                }}
              >
                W
              </button>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  color: 'var(--ctp-overlay0)',
                  backgroundColor: 'var(--ctp-surface1)',
                }}
              >
                ESC
              </span>
            </div>
          </div>

          {/* Replace input row */}
          {replaceMode && (
            <div
              className="flex items-center gap-3 px-4"
              style={{ borderTop: '1px solid var(--ctp-surface1)' }}
            >
              <div className="shrink-0" style={{ width: 14 }} />
              <Replace size={16} style={{ color: 'var(--ctp-peach)', flexShrink: 0 }} />
              <input
                ref={replaceInputRef}
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={handleReplaceKeyDown}
                placeholder={t('replace.placeholder')}
                className="flex-1 py-3 text-sm outline-none"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--ctp-text)',
                }}
              />
              <div className="flex items-center gap-2 shrink-0">
                {replaceStatus && (
                  <span className="text-xs" style={{ color: 'var(--ctp-green)' }}>
                    {replaceStatus}
                  </span>
                )}
                <button
                  onClick={() => handleReplace(false)}
                  className="text-xs px-2 py-1 rounded transition-colors bg-[var(--ctp-surface1)] text-[var(--ctp-overlay1)] hover:bg-[var(--ctp-surface2)] hover:text-[var(--ctp-accent)]"
                  title={t('replace.titleSelected')}
                >
                  {t('replace.button')}
                </button>
                <button
                  onClick={() => handleReplace(true)}
                  className="text-xs px-2 py-1 rounded transition-colors bg-[var(--ctp-surface1)] text-[var(--ctp-overlay1)] hover:bg-[var(--ctp-surface2)] hover:text-[var(--ctp-accent)]"
                  title={t('replace.titleAll')}
                >
                  {t('replace.buttonAll')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Split: file list + match preview */}
        <div className="flex" style={{ height: '440px', maxHeight: '60vh' }}>
          {/* Left: file list */}
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
            {query && !loading && groups.length === 0 && (
              <div
                className="px-4 py-8 text-sm text-center"
                style={{ color: 'var(--ctp-overlay0)' }}
              >
                {t('noMatchingFiles')}
              </div>
            )}

            {!query && (
              <div
                className="flex flex-col items-center justify-center gap-2 h-full"
                style={{ color: 'var(--ctp-overlay0)' }}
              >
                <Search size={32} strokeWidth={1} />
                <p className="text-xs">{t('typeToSearch')}</p>
              </div>
            )}

            {groups.map((group, i) => {
              const isSelected = i === selectedIndex;
              return (
                <div
                  key={group.filePath}
                  role="option"
                  aria-selected={isSelected}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm"
                  style={{
                    backgroundColor: isSelected ? 'var(--ctp-surface0)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--ctp-green)' : '2px solid transparent',
                    color: 'var(--ctp-text)',
                  }}
                  onClick={(e) => handleSelect(group, e.ctrlKey || e.metaKey)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <FileText
                    size={14}
                    style={{
                      color: isSelected ? 'var(--ctp-green)' : 'var(--ctp-overlay1)',
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
                      {group.fileName}
                    </span>
                    {group.dir && (
                      <span
                        className="truncate text-xs"
                        style={{ color: 'var(--ctp-overlay0)' }}
                      >
                        {group.dir}
                      </span>
                    )}
                  </div>
                  <span
                    className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      color: 'var(--ctp-overlay0)',
                      backgroundColor: isSelected ? 'var(--ctp-surface1)' : 'var(--ctp-surface0)',
                    }}
                  >
                    {group.matches.length}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right: match preview */}
          <div
            className="flex-1 overflow-y-auto"
            style={{
              backgroundColor: 'var(--ctp-base)',
            }}
          >
            {selectedGroup ? (
              <div className="py-2">
                {/* File header */}
                <div
                  className="flex items-center gap-2 px-4 py-2 text-xs font-medium sticky top-0"
                  style={{
                    backgroundColor: 'var(--ctp-base)',
                    color: 'var(--ctp-subtext1)',
                    borderBottom: '1px solid var(--ctp-surface0)',
                  }}
                >
                  <FileText size={12} style={{ color: 'var(--ctp-green)' }} />
                  <span>{selectedGroup.fileName}</span>
                  <span style={{ color: 'var(--ctp-overlay0)' }}>
                    — {t(selectedGroup.matches.length === 1 ? 'preview.matchCount_one' : 'preview.matchCount_other', { count: selectedGroup.matches.length })}
                  </span>
                </div>

                {/* Match lines */}
                {selectedGroup.matches.map((m, idx) => (
                  <div
                    key={`${m.filePath}:${m.lineNumber}:${idx}`}
                    className="flex items-start gap-3 px-4 py-1.5 text-xs hover:bg-[var(--ctp-surface0)] cursor-pointer transition-colors"
                    onClick={(e) => {
                      if (vaultPath) {
                        useEditorStore.setState({ pendingScrollLine: m.lineNumber });
                        openFile(vaultPath, m.filePath, e.ctrlKey || e.metaKey);
                      }
                      onClose();
                    }}
                  >
                    <span
                      className="shrink-0 w-8 text-right pt-px select-none"
                      style={{ color: 'var(--ctp-overlay0)', fontSize: '0.6875rem', fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {m.lineNumber}
                    </span>
                    <span
                      className="flex-1"
                      style={{
                        color: 'var(--ctp-text)',
                        lineHeight: '1.6',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.75rem',
                      }}
                    >
                      {highlightQuery(m.lineText, query, useRegex, caseSensitive)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center h-full gap-2"
                style={{ color: 'var(--ctp-overlay0)' }}
              >
                <span className="text-xs" style={{ fontStyle: 'italic' }}>
                  {groups.length > 0 ? t('selectFileToPreview') : t('noFileSelected')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
