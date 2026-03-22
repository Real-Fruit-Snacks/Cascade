import { useCallback, useEffect, useRef, useState } from 'react';
import { Folder, FolderOpen, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { useVaultStore } from '../stores/vault-store';
import i18n from '../i18n';
import { flavors } from '../styles/catppuccin-flavors';

const mod = navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl';

export function OnboardingScreen() {
  const { t } = useTranslation('common');
  const recentVaults = useVaultStore((s) => s.recentVaults);
  const openVault = useVaultStore((s) => s.openVault);
  const isLoading = useVaultStore((s) => s.isLoading);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  // Apply Mocha theme locally to the onboarding screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const mocha = flavors['mocha'];
    for (const [key, value] of Object.entries(mocha)) {
      const cssKey = key.replace(/([A-Z])/g, (_, c: string) => c.toLowerCase());
      el.style.setProperty(`--ctp-${cssKey}`, value);
    }
  }, []);

  const handleOpenVault = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false, title: i18n.t('dialogs:openVault.title') });
    if (selected && typeof selected === 'string') {
      setLoadingPath(selected);
      await openVault(selected);
    }
  }, [openVault]);

  const handleCreateVault = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false, title: i18n.t('dialogs:openVault.selectFolder') });
    if (selected && typeof selected === 'string') {
      setLoadingPath(selected);
      await openVault(selected);
    }
  }, [openVault]);

  const handleOpenRecent = useCallback(async (path: string) => {
    setLoadingPath(path);
    await openVault(path);
  }, [openVault]);

  // Full-screen loading overlay when vault is being opened
  if (isLoading && loadingPath) {
    const vaultName = loadingPath.replace(/\\/g, '/').split('/').pop() ?? loadingPath;
    return (
      <div
        ref={containerRef}
        className="flex flex-col items-center justify-center flex-1 w-full"
        style={{ backgroundColor: 'var(--ctp-base)' }}
      >
        <div className="flex flex-col items-center gap-6">
          <img
            src="/app-icon.png"
            alt="Cascade"
            style={{ width: 120, height: 120, opacity: 0.9 }}
            draggable={false}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <Loader2
                size={18}
                className="animate-spin"
                style={{ color: 'var(--ctp-mauve)' }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--ctp-text)' }}
              >
                {t('onboarding.openingVault', { name: vaultName })}
              </span>
            </div>
            <span
              className="text-xs"
              style={{ color: 'var(--ctp-overlay0)' }}
            >
              {loadingPath}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center flex-1 w-full"
      style={{ backgroundColor: 'var(--ctp-base)' }}
    >
      {/* Logo + App name */}
      <div className="flex flex-col items-center gap-4 mb-10">
        <img
          src="/app-icon.png"
          alt="Cascade"
          style={{ width: 180, height: 180 }}
          draggable={false}
        />
        <div className="flex flex-col items-center gap-1">
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{ color: 'var(--ctp-text)' }}
          >
            Cascade
          </h1>
          <p className="text-sm" style={{ color: 'var(--ctp-subtext0)' }}>
            {t('onboarding.tagline')}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-3 w-full" style={{ maxWidth: 280 }}>
        <button
          onClick={handleOpenVault}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--ctp-lavender)] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--ctp-mauve)',
            color: 'var(--ctp-base)',
          }}
        >
          <FolderOpen size={16} />
          {t('onboarding.openVault')}
        </button>
        <button
          onClick={handleCreateVault}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-colors hover:bg-[var(--ctp-surface1)] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface1)',
          }}
        >
          <Folder size={16} />
          {t('onboarding.createNewVault')}
        </button>
      </div>

      {/* Recent vaults */}
      {recentVaults.length > 0 && (
        <div className="mt-10 w-full" style={{ maxWidth: 360 }}>
          <p
            className="text-xs font-medium mb-2 px-1"
            style={{ color: 'var(--ctp-overlay1)' }}
          >
            {t('onboarding.recentVaults')}
          </p>
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--ctp-surface0)' }}
          >
            {recentVaults.slice(0, 5).map((vaultPath, i) => {
              const name = vaultPath.replace(/\\/g, '/').split('/').pop() ?? vaultPath;
              const isLast = i === Math.min(recentVaults.length, 5) - 1;
              return (
                <button
                  key={vaultPath}
                  onClick={() => handleOpenRecent(vaultPath)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--ctp-surface0)]"
                  style={{
                    backgroundColor: 'var(--ctp-mantle)',
                    borderBottom: isLast ? undefined : '1px solid var(--ctp-surface0)',
                    color: 'var(--ctp-text)',
                  }}
                >
                  <Folder size={14} style={{ color: 'var(--ctp-mauve)', flexShrink: 0 }} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{name}</span>
                    <span
                      className="text-xs truncate"
                      style={{ color: 'var(--ctp-overlay0)' }}
                    >
                      {vaultPath}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Keyboard shortcuts reference */}
      <div
        className="flex items-center gap-6 mt-12 text-xs ctp-overlay0"
      >
        <span><kbd style={{ fontFamily: 'monospace' }}>{`${mod}+O`}</kbd> {t('onboarding.shortcutOpenVault')}</span>
      </div>
    </div>
  );
}
