import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { useSettingsStore } from '../../../stores/settings-store';
import { usePluginStore } from '../../../stores/plugin-store';
import { useVaultStore } from '../../../stores/vault-store';

export function PluginMarketplace() {
  const { t: tp } = useTranslation('plugins');
  const { t } = useTranslation('common');
  const [registry, setRegistry] = useState<import('../../../lib/plugin-registry').RegistryPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installError, setInstallError] = useState<Record<string, string>>({});
  const [installSuccess, setInstallSuccess] = useState<Record<string, boolean>>({});
  const [newRegistryUrl, setNewRegistryUrl] = useState('');
  const pluginRegistries = useSettingsStore((s) => s.pluginRegistries);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  useEffect(() => {
    setLoading(true);
    import('../../../lib/plugin-registry').then(({ fetchPluginRegistry }) =>
      fetchPluginRegistry(pluginRegistries)
    ).then(setRegistry).catch(() => setRegistry([])).finally(() => setLoading(false));
  }, [pluginRegistries]);

  const filtered = registry.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleInstall = async (plugin: import('../../../lib/plugin-registry').RegistryPlugin) => {
    if (!vaultPath) return;
    setInstalling(plugin.id);
    setInstallError((prev) => ({ ...prev, [plugin.id]: '' }));
    setInstallSuccess((prev) => ({ ...prev, [plugin.id]: false }));
    try {
      const { installPlugin } = await import('../../../lib/plugin-registry');
      await installPlugin(vaultPath, plugin);
      await usePluginStore.getState().discoverPlugins(vaultPath);
      setInstallSuccess((prev) => ({ ...prev, [plugin.id]: true }));
    } catch (err) {
      setInstallError((prev) => ({ ...prev, [plugin.id]: String(err) }));
    } finally {
      setInstalling(null);
    }
  };

  const handleAddRegistry = () => {
    const url = newRegistryUrl.trim();
    if (!url || pluginRegistries.includes(url)) return;
    useSettingsStore.getState().update({ pluginRegistries: [...pluginRegistries, url] });
    setNewRegistryUrl('');
  };

  const handleRemoveRegistry = (url: string) => {
    useSettingsStore.getState().update({ pluginRegistries: pluginRegistries.filter((r) => r !== url) });
  };

  const PERMISSION_COLORS: Record<string, string> = {
    'read-vault': 'var(--ctp-blue)',
    'write-vault': 'var(--ctp-peach)',
    'delete-vault': 'var(--ctp-red)',
    'network': 'var(--ctp-mauve)',
    'shell': 'var(--ctp-red)',
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ctp-overlay0)' }} />
        <input
          type="text"
          placeholder={tp('marketplace.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface1)' }}
        />
      </div>

      {/* Plugin list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{tp('marketplace.loadingRegistry')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {registry.length === 0 ? tp('marketplace.noPluginsFound') : tp('marketplace.noPluginsMatch')}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((plugin) => (
            <div
              key={plugin.id}
              className="flex flex-col gap-2 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: 'var(--ctp-surface0)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--ctp-text)' }}>{plugin.name}</span>
                    <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>v{plugin.version}</span>
                    <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{tp('marketplace.by', { author: plugin.author })}</span>
                  </div>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--ctp-subtext0)' }}>{plugin.description}</p>
                  {plugin.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {plugin.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: 'var(--ctp-surface1)', color: PERMISSION_COLORS[perm] ?? 'var(--ctp-subtext0)', border: `1px solid ${PERMISSION_COLORS[perm] ?? 'var(--ctp-overlay0)'}` }}
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: installSuccess[plugin.id] ? 'var(--ctp-green)' : 'var(--ctp-blue)', color: 'var(--ctp-base)' }}
                  onClick={() => handleInstall(plugin)}
                  disabled={installing === plugin.id || installSuccess[plugin.id]}
                >
                  {installing === plugin.id ? tp('marketplace.installing') : installSuccess[plugin.id] ? tp('marketplace.installed') : t('install')}
                </button>
              </div>
              {installError[plugin.id] && (
                <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(243,139,168,0.15)', color: 'var(--ctp-red)' }}>
                  {installError[plugin.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Registry management */}
      <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--ctp-subtext0)' }}>{tp('marketplace.registries')}</span>
        {pluginRegistries.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{tp('marketplace.noRegistries')}</span>
        )}
        {pluginRegistries.map((url) => (
          <div key={url} className="flex items-center justify-between gap-2 rounded px-2 py-1.5" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
            <span className="text-xs truncate" style={{ color: 'var(--ctp-subtext0)' }}>{url}</span>
            <button
              className="shrink-0 p-1 rounded transition-colors hover:brightness-110"
              style={{ color: 'var(--ctp-red)' }}
              onClick={() => handleRemoveRegistry(url)}
              title={tp('marketplace.removeRegistry')}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            placeholder={tp('marketplace.registryPlaceholder')}
            value={newRegistryUrl}
            onChange={(e) => setNewRegistryUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddRegistry(); }}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
            style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface1)' }}
          />
          <button
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-text)' }}
            onClick={handleAddRegistry}
            disabled={!newRegistryUrl.trim()}
          >
            {t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
