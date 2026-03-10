import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Puzzle } from 'lucide-react';
import { type PluginEntry } from '../../../stores/plugin-store';
import { useVaultStore } from '../../../stores/vault-store';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { RenderedMarkdown } from './RenderedMarkdown';

interface PluginDetailProps {
  entry: PluginEntry;
  onBack: () => void;
  onToggle: () => void;
}

export function PluginDetail({ entry, onBack, onToggle }: PluginDetailProps) {
  const { t: tp } = useTranslation('plugins');
  const { t } = useTranslation('common');
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [readme, setReadme] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(true);

  useEffect(() => {
    if (!vaultPath) { setReadmeLoading(false); return; }
    const id = entry.manifest.id;
    const tryFiles = ['README.md', 'readme.md', 'Readme.md', 'README.txt', 'readme.txt'];
    let cancelled = false;

    (async () => {
      for (const file of tryFiles) {
        try {
          const content = await import('../../../lib/tauri-commands').then((cmd) =>
            cmd.readFile(vaultPath, `.cascade/plugins/${id}/${file}`)
          );
          if (!cancelled) { setReadme(content); setReadmeLoading(false); }
          return;
        } catch {
          // Try next file
        }
      }
      if (!cancelled) { setReadme(null); setReadmeLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [vaultPath, entry.manifest.id]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--ctp-surface1)]"
          style={{ color: 'var(--ctp-accent)' }}
        >
          {tp('detail.back')}
        </button>
      </div>

      {/* Plugin info card */}
      <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 40, height: 40, backgroundColor: 'var(--ctp-surface1)' }}>
              <Puzzle size={20} style={{ color: 'var(--ctp-accent)' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold" style={{ color: 'var(--ctp-text)' }}>
                  {entry.manifest.name}
                </span>
                <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
                  v{entry.manifest.version}
                </span>
              </div>
              <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
                {entry.manifest.id}
              </span>
            </div>
          </div>
          <ToggleSwitch checked={entry.enabled} onChange={onToggle} />
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay1)' }}>{tp('detail.statusLabel')}</span>
          {entry.loaded ? (
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-green)' }}>{tp('detail.statusActive')}</span>
          ) : entry.enabled ? (
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-yellow)' }}>{tp('detail.statusEnabledNotLoaded')}</span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{tp('detail.statusDisabled')}</span>
          )}
        </div>

        {entry.error && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-2 text-xs"
            style={{ backgroundColor: 'rgba(243, 139, 168, 0.12)', border: '1px solid rgba(243, 139, 168, 0.25)', color: 'var(--ctp-red)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="break-all">{entry.error}</span>
          </div>
        )}

        {/* Permissions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay1)' }}>{tp('detail.permissionsLabel')}</span>
          {entry.manifest.permissions.map((perm) => (
            <span
              key={perm}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-subtext0)' }}
            >
              {perm}
            </span>
          ))}
        </div>
      </div>

      {/* README */}
      <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
        <span className="text-xs font-medium block mb-2" style={{ color: 'var(--ctp-overlay1)' }}>
          {tp('detail.readmeSection')}
        </span>
        {readmeLoading ? (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('loading')}</span>
        ) : readme ? (
          <RenderedMarkdown content={readme} />
        ) : (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {tp('detail.noReadme')}
          </span>
        )}
      </div>
    </div>
  );
}
