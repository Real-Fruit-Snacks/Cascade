import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../stores/settings-store';
import { usePluginStore, type PluginEntry } from '../../../stores/plugin-store';
import { useVaultStore } from '../../../stores/vault-store';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { PluginMarketplace } from './PluginMarketplace';
import { PluginDetail } from './PluginDetail';

export function PluginsSection() {
  const { t: tp } = useTranslation('plugins');
  const pluginsEnabled = useSettingsStore((s) => s.pluginsEnabled);
  const plugins = usePluginStore((s) => s.plugins);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const entries = Array.from(plugins.values());
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [pluginView, setPluginView] = useState<'installed' | 'browse'>('installed');

  const handleEnablePlugins = async () => {
    useSettingsStore.getState().update({ pluginsEnabled: true });
    if (vaultPath) {
      usePluginStore.getState().discoverPlugins(vaultPath);
    }
  };

  const handleDisablePlugins = async () => {
    await usePluginStore.getState().unloadAll();
    useSettingsStore.getState().update({ pluginsEnabled: false, enabledPlugins: [] });
  };

  if (!pluginsEnabled) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-full"
          style={{ backgroundColor: 'var(--ctp-surface1)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ctp-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold" style={{ color: 'var(--ctp-text)' }}>
            {tp('section.thirdPartyPlugins')}
          </span>
          <span className="text-xs leading-relaxed" style={{ color: 'var(--ctp-subtext0)' }}>
            {tp('section.thirdPartyWarning')}
          </span>
        </div>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:brightness-110"
          style={{ backgroundColor: 'var(--ctp-accent)', color: 'var(--ctp-base)' }}
          onClick={handleEnablePlugins}
        >
          {tp('section.turnOnPlugins')}
        </button>
      </div>
    );
  }

  const handleOpenPluginFolder = async () => {
    if (!vaultPath) return;
    const pluginDir = `${vaultPath}/.cascade/plugins`.replace(/\//g, '\\');
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(pluginDir);
    } catch (e) {
      console.warn('Failed to open plugins folder:', e);
    }
  };

  const viewToggle = (
    <div className="flex rounded-lg p-0.5 mb-3" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
      {(['installed', 'browse'] as const).map((view) => (
        <button
          key={view}
          className="flex-1 px-3 py-1 rounded text-xs font-medium transition-all capitalize"
          style={{
            backgroundColor: pluginView === view ? 'var(--ctp-surface2)' : 'transparent',
            color: pluginView === view ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
          }}
          onClick={() => { setSelectedPlugin(null); setPluginView(view); }}
        >
          {view === 'installed' ? tp('section.tabInstalled') : tp('section.tabBrowse')}
        </button>
      ))}
    </div>
  );

  const pluginsHeader = (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
            {tp('section.thirdPartyEnabled')}
          </span>
          <button
            className="p-1.5 rounded transition-colors cursor-pointer"
            style={{ color: 'var(--ctp-subtext0)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--ctp-surface1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={handleOpenPluginFolder}
            title={tp('section.openPluginsFolder')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
        <ToggleSwitch checked={pluginsEnabled} onChange={handleDisablePlugins} />
      </div>
      {viewToggle}
    </div>
  );

  const handleToggle = async (entry: PluginEntry) => {
    const store = usePluginStore.getState();
    if (entry.enabled) {
      await store.disablePlugin(entry.manifest.id);
    } else {
      await store.enablePlugin(entry.manifest.id);
      if (vaultPath) {
        await store.loadPlugin(entry.manifest.id, vaultPath);
      }
    }
  };

  if (pluginView === 'browse') {
    return (
      <div className="flex flex-col gap-0">
        {pluginsHeader}
        <PluginMarketplace />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div>
        {pluginsHeader}
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {tp('section.noPluginsInstalled')}
          </span>
        </div>
      </div>
    );
  }

  const selected = selectedPlugin ? plugins.get(selectedPlugin) : null;
  if (selected) {
    return <PluginDetail entry={selected} onBack={() => setSelectedPlugin(null)} onToggle={() => handleToggle(selected)} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {pluginsHeader}
      {entries.map((entry) => (
        <div
          key={entry.manifest.id}
          role="button"
          tabIndex={0}
          className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition-colors hover:brightness-110 cursor-pointer"
          style={{ backgroundColor: 'var(--ctp-surface0)' }}
          onClick={() => setSelectedPlugin(entry.manifest.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPlugin(entry.manifest.id); } }}
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>
                {entry.manifest.name}
              </span>
              <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
                v{entry.manifest.version}
              </span>
              {entry.loaded && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--ctp-green)', color: 'var(--ctp-base)' }}>
                  {tp('section.active')}
                </span>
              )}
            </div>
            {entry.error && (
              <div
                className="flex items-center gap-1.5 mt-1 px-2 py-1 rounded text-xs"
                style={{ backgroundColor: 'rgba(243, 139, 168, 0.15)', color: 'var(--ctp-red)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="truncate">{entry.error}</span>
              </div>
            )}
          </div>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <ToggleSwitch checked={entry.enabled} onChange={() => handleToggle(entry)} />
          </div>
        </div>
      ))}
    </div>
  );
}
