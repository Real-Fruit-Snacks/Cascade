import { useCallback, useEffect, useRef, useState } from 'react';
import { Folder, FolderOpen, FolderPlus, Download, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { useVaultStore } from '../stores/vault-store';
import i18n from '../i18n';
import { flavors } from '../styles/catppuccin-flavors';

function ActionCard({
  icon,
  iconBg,
  iconColor,
  hoverColor,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  hoverColor: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center gap-3 rounded-xl px-6 py-5 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        width: 160,
        backgroundColor: hovered ? 'var(--ctp-base)' : 'var(--ctp-mantle)',
        border: `1px solid ${hovered ? hoverColor : 'var(--ctp-surface0)'}`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? `0 4px 20px ${hoverColor}20` : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        className="flex items-center justify-center rounded-lg"
        style={{
          width: 40,
          height: 40,
          backgroundColor: iconBg,
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}
      >
        {icon}
      </div>
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-xs font-semibold"
          style={{ color: hovered ? iconColor : 'var(--ctp-text)', transition: 'color 0.2s ease' }}
        >
          {title}
        </span>
        <span className="text-[10px] leading-tight text-center" style={{ color: 'var(--ctp-overlay0)' }}>
          {description}
        </span>
      </div>
    </button>
  );
}

export function OnboardingScreen() {
  const { t } = useTranslation('common');
  const recentVaults = useVaultStore((s) => s.recentVaults);
  const openVault = useVaultStore((s) => s.openVault);
  const removeRecentVault = useVaultStore((s) => s.removeRecentVault);
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
              <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>
                {t('onboarding.openingVault', { name: vaultName })}
              </span>
            </div>
            <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
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
      style={{ backgroundColor: 'var(--ctp-crust)' }}
    >
      {/* Title */}
      <h1
        className="text-8xl font-extrabold mb-2"
        style={{
          letterSpacing: '-1px',
          background: 'linear-gradient(135deg, var(--ctp-mauve), var(--ctp-blue))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Cascade
      </h1>
      <p className="text-xs mb-8" style={{ color: 'var(--ctp-overlay0)' }}>
        {t('onboarding.tagline')}
      </p>

      {/* Action cards */}
      <div className="flex gap-3 mb-8">
        <ActionCard
          icon={<FolderOpen size={20} style={{ color: 'var(--ctp-mauve)' }} />}
          iconBg="rgba(203, 166, 247, 0.12)"
          iconColor="var(--ctp-mauve)"
          hoverColor="var(--ctp-mauve)"
          title={t('onboarding.openVault')}
          description={t('onboarding.openVaultDesc')}
          onClick={handleOpenVault}
          disabled={isLoading}
        />
        <ActionCard
          icon={<FolderPlus size={20} style={{ color: 'var(--ctp-green)' }} />}
          iconBg="rgba(166, 227, 161, 0.12)"
          iconColor="var(--ctp-green)"
          hoverColor="var(--ctp-green)"
          title={t('onboarding.createNewVault')}
          description={t('onboarding.createVaultDesc')}
          onClick={handleCreateVault}
          disabled={isLoading}
        />
        <ActionCard
          icon={<Download size={20} style={{ color: 'var(--ctp-blue)' }} />}
          iconBg="rgba(137, 180, 250, 0.12)"
          iconColor="var(--ctp-blue)"
          hoverColor="var(--ctp-blue)"
          title={t('onboarding.importVault')}
          description={t('onboarding.importVaultDesc')}
          onClick={handleOpenVault}
          disabled={isLoading}
        />
      </div>

      {/* Recent vaults */}
      {recentVaults.length > 0 && (
        <div className="w-full" style={{ maxWidth: 500 }}>
          <p
            className="text-[10px] font-medium uppercase tracking-widest mb-2 px-1"
            style={{ color: 'var(--ctp-overlay1)' }}
          >
            {t('onboarding.recentVaults')}
          </p>
          <div className="flex flex-col gap-1">
            {recentVaults.slice(0, 5).map((vaultPath) => {
              const name = vaultPath.replace(/\\/g, '/').split('/').pop() ?? vaultPath;
              return (
                <RecentVaultRow
                  key={vaultPath}
                  name={name}
                  path={vaultPath}
                  onClick={() => handleOpenRecent(vaultPath)}
                  onRemove={() => removeRecentVault(vaultPath)}
                />
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

function RecentVaultRow({ name, path, onClick, onRemove }: { name: string; path: string; onClick: () => void; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
      style={{
        backgroundColor: hovered ? 'var(--ctp-surface0)' : 'var(--ctp-base)',
        transition: 'background-color 0.15s ease',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <Folder
        size={14}
        style={{
          color: hovered ? 'var(--ctp-mauve)' : 'var(--ctp-overlay1)',
          flexShrink: 0,
          transition: 'color 0.15s ease',
        }}
      />
      <span
        className="text-xs font-medium truncate"
        style={{
          color: hovered ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
          transition: 'color 0.15s ease',
        }}
      >
        {name}
      </span>
      <span className="flex-1" />
      <span
        className="text-[10px] truncate max-w-[200px]"
        style={{ color: 'var(--ctp-overlay0)' }}
      >
        {path}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="flex items-center justify-center rounded shrink-0"
        style={{
          width: 20,
          height: 20,
          color: 'var(--ctp-overlay0)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--ctp-surface1)'; e.currentTarget.style.color = 'var(--ctp-red)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--ctp-overlay0)'; }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
