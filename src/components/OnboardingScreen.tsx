import { useCallback, useEffect, useRef } from 'react';
import { Folder, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { useVaultStore } from '../stores/vault-store';
import { flavors } from '../styles/catppuccin-flavors';

const mod = navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl';

export function OnboardingScreen() {
  const { t } = useTranslation('common');
  const recentVaults = useVaultStore((s) => s.recentVaults);
  const openVault = useVaultStore((s) => s.openVault);
  const containerRef = useRef<HTMLDivElement>(null);

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
    const selected = await open({ directory: true, multiple: false, title: 'Open Vault' });
    if (selected && typeof selected === 'string') {
      await openVault(selected);
    }
  }, [openVault]);

  const handleCreateVault = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Select Folder for New Vault' });
    if (selected && typeof selected === 'string') {
      // Opens the selected folder as a vault — the folder can be empty or pre-existing
      await openVault(selected);
    }
  }, [openVault]);

  const handleOpenRecent = useCallback(async (path: string) => {
    await openVault(path);
  }, [openVault]);

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
          style={{ width: 140, height: 140 }}
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
          className="w-full flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--ctp-lavender)]"
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
          className="w-full flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-colors hover:bg-[var(--ctp-surface1)]"
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
        className="flex items-center gap-6 mt-12 text-xs"
        style={{ color: 'var(--ctp-overlay0)' }}
      >
        <span><kbd style={{ fontFamily: 'monospace' }}>{`${mod}+O`}</kbd> {t('onboarding.shortcutOpenVault')}</span>
        <span><kbd style={{ fontFamily: 'monospace' }}>{`${mod}+N`}</kbd> {t('onboarding.shortcutNewFile')}</span>
        <span><kbd style={{ fontFamily: 'monospace' }}>{`${mod}+P`}</kbd> {t('onboarding.shortcutCommandPalette')}</span>
      </div>
    </div>
  );
}
