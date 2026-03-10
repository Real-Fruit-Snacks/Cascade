import { FileText, FolderOpen } from 'lucide-react';
import { useVaultStore } from '../../stores/vault-store';
import { useTranslation } from 'react-i18next';

export function WelcomeScreen() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const { t } = useTranslation('editor');
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--ctp-overlay1)' }}>
      {vaultPath ? (
        <>
          <FileText size={48} strokeWidth={1} />
          <p className="text-sm">{t('welcomeScreen.selectFile')}</p>
          <p className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('welcomeScreen.shortcuts')}</p>
        </>
      ) : (
        <>
          <FolderOpen size={48} strokeWidth={1} />
          <p className="text-sm">{t('welcomeScreen.openVault')}</p>
        </>
      )}
    </div>
  );
}
