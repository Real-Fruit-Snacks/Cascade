import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01, FileText, Hash, Search, X } from 'lucide-react';
import { useVaultStore } from '../../stores/vault-store';
import { useEditorStore } from '../../stores/editor-store';
import { useToastStore } from '../../stores/toast-store';
import { parseFileParts } from '../../lib/path-utils';
import { SkeletonLine } from '../Skeleton';

type TagSortMode = 'count-desc' | 'count-asc' | 'alpha-asc' | 'alpha-desc';

export function TagPanel() {
  const { t } = useTranslation('sidebar');

  const tagIndex = useVaultStore((s) => s.tagIndex);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const isIndexing = useVaultStore((s) => s.isIndexing);
  const renameTag = useVaultStore((s) => s.renameTag);
  const openFile = useEditorStore((s) => s.openFile);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<TagSortMode>(
    () => (localStorage.getItem('cascade-tag-sort') as TagSortMode) || 'count-desc',
  );
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Listen for tag clicks from the editor
  useEffect(() => {
    const handler = (e: Event) => {
      const tag = (e as CustomEvent<string>).detail;
      setActiveTag(tag);
    };
    window.addEventListener('cascade:filter-tag', handler);
    return () => window.removeEventListener('cascade:filter-tag', handler);
  }, []);

  const cycleSortMode = () => {
    const modes: TagSortMode[] = ['count-desc', 'count-asc', 'alpha-asc', 'alpha-desc'];
    const next = modes[(modes.indexOf(sortMode) + 1) % modes.length];
    setSortMode(next);
    localStorage.setItem('cascade-tag-sort', next);
  };

  // Sort tags by selected mode, then filter by search
  const sortedTags = useMemo(() => {
    const entries: [string, number][] = [];
    const q = search.toLowerCase();
    for (const [tag, files] of tagIndex) {
      if (!q || tag.toLowerCase().includes(q)) {
        entries.push([tag, files.size]);
      }
    }
    switch (sortMode) {
      case 'count-desc': return [...entries].sort((a, b) => b[1] - a[1]);
      case 'count-asc': return [...entries].sort((a, b) => a[1] - b[1]);
      case 'alpha-asc': return [...entries].sort((a, b) => a[0].localeCompare(b[0]));
      case 'alpha-desc': return [...entries].sort((a, b) => b[0].localeCompare(a[0]));
    }
  }, [tagIndex, search, sortMode]);

  // Files matching active tag
  const matchingFiles = useMemo(() => {
    if (!activeTag) return [];
    const files = tagIndex.get(activeTag);
    return files ? [...files].sort() : [];
  }, [activeTag, tagIndex]);

  const startRename = (tag: string) => {
    setRenamingTag(tag);
    setRenameValue(tag);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = async () => {
    if (!renamingTag || !renameValue.trim() || renameValue.trim() === renamingTag) {
      setRenamingTag(null);
      return;
    }
    const newTag = renameValue.trim().toLowerCase().replace(/^#/, '');
    const addToast = useToastStore.getState().addToast;
    addToast(t('tags.renamingInfo', { old: renamingTag, new: newTag }), 'info');
    const count = await renameTag(renamingTag, newTag);
    if (count > 0) {
      addToast(t('tags.renamedSuccess', { count }), 'success');
    } else {
      addToast(t('tags.noFilesUpdated'), 'warning');
    }
    // If the currently open file was affected, reload it
    const activeFilePath = useEditorStore.getState().activeFilePath;
    if (count > 0 && vaultPath && activeFilePath) {
      await openFile(vaultPath, activeFilePath);
    }
    if (activeTag === renamingTag) setActiveTag(newTag);
    setRenamingTag(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 font-semibold uppercase shrink-0"
        style={{ fontSize: 'var(--text-2xs)', letterSpacing: '0.05em', color: 'var(--ctp-overlay1)', borderBottom: '1px solid var(--ctp-surface1)' }}
      >
        <Hash size={12} />
        {t('panels.tags')}
        {sortedTags.length > 0 && (
          <span style={{ color: 'var(--ctp-overlay0)' }}>{sortedTags.length}</span>
        )}
        <button
          onClick={cycleSortMode}
          className="ml-auto p-1 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
          style={{ color: 'var(--ctp-overlay1)' }}
          title={
            sortMode === 'count-desc' ? t('tooltips.sortCountHighLow')
            : sortMode === 'count-asc' ? t('tooltips.sortCountLowHigh')
            : sortMode === 'alpha-asc' ? t('tooltips.sortNameAZ')
            : t('tooltips.sortNameZA')
          }
        >
          {sortMode === 'count-desc' ? <ArrowDown01 size={16} />
            : sortMode === 'count-asc' ? <ArrowUp01 size={16} />
            : sortMode === 'alpha-asc' ? <ArrowDownAZ size={16} />
            : <ArrowUpAZ size={16} />}
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1 shrink-0">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
          }}
        >
          <Search size={12} style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filters.searchTags')}
            className="flex-1 bg-transparent outline-none placeholder:text-[var(--ctp-overlay0)]"
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

      {isIndexing ? (
        <div className="flex flex-col gap-2 px-3 py-2">
          <SkeletonLine width="65%" />
          <SkeletonLine width="80%" />
          <SkeletonLine width="50%" />
          <SkeletonLine width="72%" />
          <SkeletonLine width="58%" />
          <SkeletonLine width="85%" />
        </div>
      ) : sortedTags.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 py-8 px-4 text-center">
          <Hash size={32} strokeWidth={1} style={{ color: 'var(--ctp-surface2)' }} />
          <p className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('emptyStates.noTags')}</p>
          <p className="text-[0.65rem]" style={{ color: 'var(--ctp-surface2)' }}>
            {search ? 'Try a different search term' : 'Add #tags anywhere in your notes'}
          </p>
        </div>
      ) : (
        <>
        {/* Active tag filter bar — outside scroll container so it stays fixed */}
        {activeTag && (
          <div
            className="flex items-center gap-2 mx-2 mt-2 mb-1 px-2.5 py-1.5 rounded-lg text-xs"
            style={{
              backgroundColor: 'var(--ctp-mantle)',
              color: 'var(--ctp-accent)',
              border: '1px solid var(--ctp-surface0)',
            }}
          >
            <Hash size={11} />
            <span className="flex-1 font-medium">{activeTag}</span>
            <span style={{ color: 'var(--ctp-overlay0)' }}>
              {t('tags.noteCount', { count: matchingFiles.length })}
            </span>
            <button
              onClick={() => setActiveTag(null)}
              className="rounded p-0.5 hover:bg-[var(--ctp-surface1)] transition-colors"
            >
              <X size={11} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>

          {/* Filtered file list when a tag is active */}
          {activeTag && matchingFiles.length > 0 && (
            <div className="px-1 py-1">
              {matchingFiles.map((filePath) => {
                const { fileName: name, dir } = parseFileParts(filePath);
                return (
                  <button
                    key={filePath}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded text-left hover:bg-[var(--ctp-surface0)] transition-colors"
                    style={{ color: 'var(--ctp-subtext1)' }}
                    onClick={(e) => {
                      if (vaultPath) openFile(vaultPath, filePath, e.ctrlKey || e.metaKey);
                    }}
                  >
                    <FileText
                      size={12}
                      style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }}
                    />
                    <div className="flex flex-col truncate">
                      <span className="truncate">{name}</span>
                      {dir && (
                        <span
                          className="truncate text-[10px]"
                          style={{ color: 'var(--ctp-overlay0)' }}
                        >
                          {dir}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tag list when no tag is active */}
          {!activeTag && (
            <div className="px-1 py-1">
              {sortedTags.map(([tag, count]) => (
                renamingTag === tag ? (
                  <div
                    key={tag}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded"
                    style={{ backgroundColor: 'var(--ctp-surface0)' }}
                  >
                    <Hash size={12} style={{ color: 'var(--ctp-accent)', flexShrink: 0 }} />
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingTag(null);
                      }}
                      onBlur={commitRename}
                      className="flex-1 bg-transparent outline-none text-xs"
                      style={{ color: 'var(--ctp-text)' }}
                    />
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--ctp-overlay0)' }}>Esc to cancel</span>
                  </div>
                ) : (
                  <button
                    key={tag}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded text-left hover:bg-[var(--ctp-surface0)] transition-colors"
                    style={{ color: 'var(--ctp-text)' }}
                    onClick={() => setActiveTag(tag)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      startRename(tag);
                    }}
                  >
                    <Hash
                      size={12}
                      style={{ color: 'var(--ctp-accent)', flexShrink: 0 }}
                    />
                    <span className="flex-1 truncate">{tag}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        color: 'var(--ctp-accent)',
                        backgroundColor: 'color-mix(in srgb, var(--ctp-accent) 15%, transparent)',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                )
              ))}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
