import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from 'lucide-react';
import { useVaultStore } from '../../stores/vault-store';

export function VaultPicker() {
  const { t } = useTranslation('sidebar');

  const vaultPath = useVaultStore((s) => s.vaultPath);
  const openVault = useVaultStore((s) => s.openVault);

  const vaultName = vaultPath
    ? vaultPath.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? vaultPath
    : null;

  const handleOpen = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === 'string') {
      await openVault(selected);
    }
  };

  return (
    <div className="px-2 py-2">
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors bg-[var(--ctp-surface0)] hover:bg-[var(--ctp-surface1)]"
        style={{ color: 'var(--ctp-text)' }}
      >
        <FolderOpen size={14} />
        <span className="truncate">{vaultName ?? t('vault.openVault')}</span>
      </button>
    </div>
  );
}
