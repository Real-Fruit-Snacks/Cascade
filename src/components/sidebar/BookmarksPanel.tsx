import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Star, X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings-store';
import { useEditorStore } from '../../stores/editor-store';
import { useVaultStore } from '../../stores/vault-store';

export function BookmarksPanel() {
  const { t } = useTranslation('sidebar');

  const bookmarkedFiles = useSettingsStore((s) => s.bookmarkedFiles);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const bookmarks = useMemo(() => {
    return (bookmarkedFiles ?? []).map((filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      const name = normalized.split('/').pop() || filePath;
      return { path: filePath, name };
    });
  }, [bookmarkedFiles]);

  const filtered = useMemo(() => {
    if (!deferredSearch) return bookmarks;
    const q = deferredSearch.toLowerCase();
    return bookmarks.filter(({ name }) => name.toLowerCase().includes(q));
  }, [bookmarks, deferredSearch]);

  const handleOpen = (path: string) => {
    if (vaultPath) {
      useEditorStore.getState().openFile(vaultPath, path);
    }
  };

  const handleRemove = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const settings = useSettingsStore.getState();
    settings.update({
      bookmarkedFiles: (settings.bookmarkedFiles ?? []).filter((p) => p !== path),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--ctp-overlay1)' }}>
          {t('panels.bookmarks')}
        </span>
      </div>

      <div className="px-2 pb-1">
        <div className="flex items-center gap-1.5 px-2 rounded" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
          <Search size={13} style={{ color: 'var(--ctp-overlay0)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filters.filterBookmarks')}
            className="w-full py-1 text-xs outline-none"
            style={{ backgroundColor: 'transparent', color: 'var(--ctp-text)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="p-0.5 rounded hover:bg-[var(--ctp-surface1)] transition-colors"
              style={{ color: 'var(--ctp-overlay0)', flexShrink: 0 }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1" style={{ overscrollBehavior: 'contain' }}>
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
            <Star size={32} strokeWidth={1} style={{ color: 'var(--ctp-surface2)' }} />
            <p className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('emptyStates.noBookmarks')}</p>
            <p className="text-[0.65rem]" style={{ color: 'var(--ctp-surface2)' }}>{t('emptyStates.noBookmarksHint')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
            <Search size={32} strokeWidth={1} style={{ color: 'var(--ctp-surface2)' }} />
            <p className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('emptyStates.noMatchingBookmarks')}</p>
          </div>
        ) : (
          filtered.map(({ path, name }) => (
            <div
              key={path}
              className="group flex items-center gap-1.5 px-3 py-0.5 cursor-pointer text-sm rounded-sm hover:bg-[var(--ctp-surface0)] transition-colors"
              style={{ color: 'var(--ctp-text)' }}
              onClick={() => handleOpen(path)}
            >
              <Star size={14} className="shrink-0" style={{ color: 'var(--ctp-yellow)' }} fill="var(--ctp-yellow)" />
              <span className="truncate min-w-0">{name.replace(/\.[^.]+$/, '')}</span>
              <button
                onClick={(e) => handleRemove(path, e)}
                className="shrink-0 ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--ctp-surface1)] transition-all"
                style={{ color: 'var(--ctp-overlay1)' }}
                title={t('tooltips.removeBookmark')}
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
