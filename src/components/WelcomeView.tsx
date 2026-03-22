import { useMemo } from 'react';
import { FileText, Hash, Link, X, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useRecentFilesStore } from '../stores/recent-files-store';
import { useSettingsStore } from '../stores/settings-store';
import type { FileEntry } from '../types/index';

function formatRelativeTime(timestamp: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('welcomeView.timeJustNow');
  if (minutes < 60) return t('welcomeView.timeMinutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('welcomeView.timeHoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('welcomeView.timeYesterday');
  if (days < 7) return t('welcomeView.timeDaysAgo', { count: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t('welcomeView.timeWeeksAgo', { count: weeks });
  const months = Math.floor(days / 30);
  return t('welcomeView.timeMonthsAgo', { count: months });
}

function buildModifiedMap(tree: FileEntry[], map: Map<string, number> = new Map()): Map<string, number> {
  for (const entry of tree) {
    if (entry.modified !== undefined) {
      map.set(entry.path, entry.modified);
    }
    if (entry.children) {
      buildModifiedMap(entry.children, map);
    }
  }
  return map;
}

const mod = navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl';

export function WelcomeView() {
  const { t } = useTranslation('editor');
  const recentFiles = useRecentFilesStore((s) => s.recentFiles);
  const openFile = useEditorStore((s) => s.openFile);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const flatFiles = useVaultStore((s) => s.flatFiles);
  const tagIndex = useVaultStore((s) => s.tagIndex);
  const backlinkIndex = useVaultStore((s) => s.backlinkIndex);
  const fileTree = useVaultStore((s) => s.fileTree);
  const update = useSettingsStore((s) => s.update);

  const vaultName = useMemo(() => {
    if (!vaultPath) return 'Vault';
    const parts = vaultPath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || 'Vault';
  }, [vaultPath]);

  const modifiedMap = useMemo(() => buildModifiedMap(fileTree), [fileTree]);

  const flatFilesSet = useMemo(() => new Set(flatFiles), [flatFiles]);

  const recentEntries = useMemo(() => {
    return recentFiles
      .filter((path) => flatFilesSet.has(path))
      .slice(0, 10)
      .map((path) => {
        const name = path.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/, '') ?? path;
        const modifiedSecs = modifiedMap.get(path);
        const relTime = modifiedSecs !== undefined ? formatRelativeTime(modifiedSecs * 1000, t) : null;
        return { path, name, relTime };
      });
  }, [recentFiles, modifiedMap, flatFilesSet, t]);

  const totalLinks = useMemo(() => {
    let count = 0;
    backlinkIndex.forEach((set) => { count += set.size; });
    return count;
  }, [backlinkIndex]);

  const topTags = useMemo(() => {
    const entries = Array.from(tagIndex.entries())
      .map(([tag, files]) => ({ tag, count: files.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
    return entries;
  }, [tagIndex]);

  const maxTagCount = topTags.length > 0 ? topTags[0].count : 1;

  function handleOpenFile(path: string) {
    if (vaultPath) {
      openFile(vaultPath, path);
    }
  }

  function handleDismiss() {
    update({ showWelcomeView: false });
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ backgroundColor: 'var(--ctp-base)', color: 'var(--ctp-text)' }}
    >
      <div className="flex-1 max-w-2xl mx-auto w-full px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: 'var(--ctp-text)' }}
            >
              {vaultName}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ctp-subtext1)' }}>
              {t('welcomeView.subtitle')}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--ctp-overlay1)' }}
            title={t('welcomeView.dismiss')}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--ctp-text)';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--ctp-surface0)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--ctp-overlay1)';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Vault Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div
            className="rounded-lg p-4 flex flex-col gap-1"
            style={{ backgroundColor: 'var(--ctp-mantle)' }}
          >
            <div className="flex items-center gap-2" style={{ color: 'var(--ctp-accent)' }}>
              <FileText size={16} />
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ctp-subtext1)' }}>{t('welcomeView.files')}</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--ctp-text)' }}>
              {flatFiles.length}
            </span>
          </div>
          <div
            className="rounded-lg p-4 flex flex-col gap-1"
            style={{ backgroundColor: 'var(--ctp-mantle)' }}
          >
            <div className="flex items-center gap-2">
              <Hash size={16} style={{ color: 'var(--ctp-accent)' }} />
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ctp-subtext1)' }}>{t('welcomeView.tags')}</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--ctp-text)' }}>
              {tagIndex.size}
            </span>
          </div>
          <div
            className="rounded-lg p-4 flex flex-col gap-1"
            style={{ backgroundColor: 'var(--ctp-mantle)' }}
          >
            <div className="flex items-center gap-2">
              <Link size={16} style={{ color: 'var(--ctp-accent)' }} />
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ctp-subtext1)' }}>{t('welcomeView.links')}</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--ctp-text)' }}>
              {totalLinks}
            </span>
          </div>
        </div>

        {/* Recent Files */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} style={{ color: 'var(--ctp-subtext1)' }} />
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ctp-subtext1)' }}>
              {t('welcomeView.recentFiles')}
            </h2>
          </div>
          {recentEntries.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ctp-overlay0)' }}>
              {t('welcomeView.openFileHint')}
            </p>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{ backgroundColor: 'var(--ctp-mantle)' }}
            >
              {recentEntries.map(({ path, name, relTime }, i) => (
                <button
                  key={path}
                  onClick={() => handleOpenFile(path)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--ctp-surface0)' : undefined,
                    color: 'var(--ctp-text)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--ctp-surface0)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }} />
                    <span className="font-medium text-sm truncate">{name}</span>
                  </div>
                  {relTime && (
                    <span className="text-xs ml-4 shrink-0" style={{ color: 'var(--ctp-overlay0)' }}>
                      {relTime}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tag Cloud */}
        {topTags.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Hash size={14} style={{ color: 'var(--ctp-subtext1)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ctp-subtext1)' }}>
                {t('welcomeView.tagsSection')}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {topTags.map(({ tag, count }) => {
                const ratio = count / maxTagCount;
                const size = 11 + Math.round(ratio * 7);
                return (
                  <span
                    key={tag}
                    className="rounded px-2 py-0.5"
                    style={{
                      fontSize: `${size}px`,
                      backgroundColor: 'var(--ctp-surface0)',
                      color: 'var(--ctp-overlay1)',
                    }}
                  >
                    #{tag}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div
          className="rounded-lg px-4 py-3 flex flex-wrap gap-x-6 gap-y-2"
          style={{ backgroundColor: 'var(--ctp-mantle)' }}
        >
          <div className="flex items-center gap-2">
            <kbd
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-subtext1)' }}
            >
              {`${mod}+O`}
            </kbd>
            <span className="text-xs" style={{ color: 'var(--ctp-overlay1)' }}>{t('welcomeView.openFile')}</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-subtext1)' }}
            >
              {`${mod}+N`}
            </kbd>
            <span className="text-xs" style={{ color: 'var(--ctp-overlay1)' }}>{t('welcomeView.newFile')}</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-subtext1)' }}
            >
              {`${mod}+P`}
            </kbd>
            <span className="text-xs" style={{ color: 'var(--ctp-overlay1)' }}>{t('welcomeView.commandPalette')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
