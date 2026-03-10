import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { useSettingsStore } from '../../../stores/settings-store';
import { useVaultStore } from '../../../stores/vault-store';

export function ThemeMarketplace() {
  const { t: ts } = useTranslation('settings');
  const [themes, setThemes] = useState<import('../../../lib/plugin-registry').RegistryTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installError, setInstallError] = useState<Record<string, string>>({});
  const [installSuccess, setInstallSuccess] = useState<Record<string, boolean>>({});
  const [newRegistryUrl, setNewRegistryUrl] = useState('');
  const themeRegistries = useSettingsStore((s) => s.themeRegistries);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  useEffect(() => {
    setLoading(true);
    import('../../../lib/plugin-registry').then(({ fetchThemeRegistry }) =>
      fetchThemeRegistry(themeRegistries)
    ).then(setThemes).catch(() => setThemes([])).finally(() => setLoading(false));
  }, [themeRegistries]);

  const filtered = themes.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleInstall = async (theme: import('../../../lib/plugin-registry').RegistryTheme) => {
    if (!vaultPath) return;
    setInstalling(theme.id);
    setInstallError((prev) => ({ ...prev, [theme.id]: '' }));
    setInstallSuccess((prev) => ({ ...prev, [theme.id]: false }));
    try {
      const { installTheme } = await import('../../../lib/plugin-registry');
      await installTheme(vaultPath, theme);
      setInstallSuccess((prev) => ({ ...prev, [theme.id]: true }));
    } catch (err) {
      setInstallError((prev) => ({ ...prev, [theme.id]: String(err) }));
    } finally {
      setInstalling(null);
    }
  };

  const handleAddRegistry = () => {
    const url = newRegistryUrl.trim();
    if (!url || themeRegistries.includes(url)) return;
    useSettingsStore.getState().update({ themeRegistries: [...themeRegistries, url] });
    setNewRegistryUrl('');
  };

  const handleRemoveRegistry = (url: string) => {
    useSettingsStore.getState().update({ themeRegistries: themeRegistries.filter((r) => r !== url) });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ctp-overlay0)' }} />
        <input
          type="text"
          placeholder={ts('appearance.themeMarketplace.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface1)' }}
        />
      </div>

      {/* Theme list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{ts('appearance.themeMarketplace.loadingRegistry')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {themes.length === 0 ? ts('appearance.themeMarketplace.noThemesFound') : ts('appearance.themeMarketplace.noThemesMatch')}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((theme) => (
            <div
              key={theme.id}
              className="flex flex-col gap-2 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: 'var(--ctp-surface0)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--ctp-text)' }}>{theme.name}</span>
                    <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>v{theme.version}</span>
                    <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{ts('appearance.themeMarketplace.by', { author: theme.author })}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: 'var(--ctp-surface1)',
                        color: theme.dark ? 'var(--ctp-blue)' : 'var(--ctp-yellow)',
                        border: `1px solid ${theme.dark ? 'var(--ctp-blue)' : 'var(--ctp-yellow)'}`,
                      }}
                    >
                      {theme.dark ? ts('appearance.themeMarketplace.darkLabel') : ts('appearance.themeMarketplace.lightLabel')}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--ctp-subtext0)' }}>{theme.description}</p>
                  {/* Color swatches */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: theme.previewColors.base, borderColor: 'var(--ctp-surface2)' }} title={ts('appearance.themeMarketplace.base')} />
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: theme.previewColors.text, borderColor: 'var(--ctp-surface2)' }} title={ts('appearance.themeMarketplace.text')} />
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: theme.previewColors.accent, borderColor: 'var(--ctp-surface2)' }} title={ts('appearance.themeMarketplace.accent')} />
                  </div>
                </div>
                <button
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: installSuccess[theme.id] ? 'var(--ctp-green)' : 'var(--ctp-blue)', color: 'var(--ctp-base)' }}
                  onClick={() => handleInstall(theme)}
                  disabled={installing === theme.id || installSuccess[theme.id]}
                >
                  {installing === theme.id ? ts('appearance.themeMarketplace.installing') : installSuccess[theme.id] ? ts('appearance.themeMarketplace.installed') : ts('appearance.themeMarketplace.install')}
                </button>
              </div>
              {installError[theme.id] && (
                <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(243,139,168,0.15)', color: 'var(--ctp-red)' }}>
                  {installError[theme.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Registry management */}
      <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--ctp-subtext0)' }}>{ts('appearance.themeMarketplace.registries')}</span>
        {themeRegistries.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{ts('appearance.themeMarketplace.noRegistries')}</span>
        )}
        {themeRegistries.map((url) => (
          <div key={url} className="flex items-center justify-between gap-2 rounded px-2 py-1.5" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
            <span className="text-xs truncate" style={{ color: 'var(--ctp-subtext0)' }}>{url}</span>
            <button
              className="shrink-0 p-1 rounded transition-colors hover:brightness-110"
              style={{ color: 'var(--ctp-red)' }}
              onClick={() => handleRemoveRegistry(url)}
              title={ts('appearance.themeMarketplace.removeRegistry')}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            placeholder={ts('appearance.themeMarketplace.registryPlaceholder')}
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
            {ts('appearance.themeMarketplace.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
