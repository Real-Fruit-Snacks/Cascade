import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { SubHeader } from '../shared/SubHeader';
import { useVaultStore } from '../../../stores/vault-store';
import { useSettingsStore } from '../../../stores/settings-store';
import { listSettingsProfiles } from '../../../lib/tauri-commands';
import { getActiveProfile, setActiveProfile, profileNameToPath, DEFAULT_SETTINGS_PATH } from '../../../lib/settings-profiles';
import { Button, Input } from '../../ui';

export function ProfileSettingsSection() {
  const { t } = useTranslation('settings');
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeProfile, setActiveProfileState] = useState<string>(DEFAULT_SETTINGS_PATH);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!vaultPath) return;
    setActiveProfileState(getActiveProfile(vaultPath));
    listSettingsProfiles(vaultPath).then(setProfiles).catch(() => setProfiles([]));
  }, [vaultPath]);

  const profileDisplayName = (path: string) =>
    path === DEFAULT_SETTINGS_PATH
      ? t('general.profile.default')
      : path.replace(/^\.cascade\/settings-/, '').replace(/\.json$/, '');

  const handleSwitch = async (path: string) => {
    if (!vaultPath || path === activeProfile) return;
    setActiveProfile(vaultPath, path);
    setActiveProfileState(path);
    await useSettingsStore.getState().loadFromVault(vaultPath);
  };

  const handleReset = () => handleSwitch(DEFAULT_SETTINGS_PATH);

  const handleCreate = async () => {
    if (!vaultPath || !newName.trim()) return;
    const path = profileNameToPath(newName.trim(), profiles);
    setActiveProfile(vaultPath, path);
    setActiveProfileState(path);
    await useSettingsStore.getState().update({});
    const updated = await listSettingsProfiles(vaultPath).catch(() => profiles);
    setProfiles(updated);
    setNewName('');
    setShowCreate(false);
  };

  const currentLabel = profileDisplayName(activeProfile);

  return (
    <>
      <SubHeader label={t('general.profile.label')} />
      <SettingRow
        label={t('general.profile.current')}
        description={t('general.profile.description')}
        onReset={activeProfile !== DEFAULT_SETTINGS_PATH ? handleReset : undefined}
      >
        <span className="text-xs px-2 py-1 rounded ctp-input">{currentLabel}</span>
      </SettingRow>

      {profiles.length > 1 && (
        <div className="flex flex-col gap-1 mt-1">
          <span className="text-xs ctp-overlay0">{t('general.profile.profiles')}</span>
          <div className="flex flex-wrap gap-1">
            {[DEFAULT_SETTINGS_PATH, ...profiles.filter((p) => p !== DEFAULT_SETTINGS_PATH)].map((p) => (
              <Button
                key={p}
                size="sm"
                variant={p === activeProfile ? 'primary' : 'secondary'}
                onClick={() => handleSwitch(p)}
              >
                {profileDisplayName(p)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {showCreate ? (
        <div className="flex items-center gap-2 mt-1">
          <Input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setShowCreate(false); setNewName(''); }
            }}
            placeholder={t('general.profile.createPlaceholder')}
            className="flex-1"
          />
          <Button size="sm" variant="secondary" onClick={handleCreate}>
            {t('general.profile.create')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewName(''); }}>
            ✕
          </Button>
        </div>
      ) : (
        <div className="mt-1">
          <Button size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
            + {t('general.profile.create')}
          </Button>
        </div>
      )}
    </>
  );
}
