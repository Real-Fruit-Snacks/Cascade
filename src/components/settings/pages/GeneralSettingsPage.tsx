import { useTranslation } from 'react-i18next';
import type { StartupBehavior } from '../../../stores/settings-store';
import { SettingRow } from '../shared/SettingRow';
import { SubHeader } from '../shared/SubHeader';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import type { CategoryPageProps } from '../shared/searchable-items';
import { checkForUpdate } from '../../../lib/update-checker';
import { useToastStore } from '../../../stores/toast-store';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ProfileSettingsSection } from './ProfileSettingsSection';
import { Button } from '../../ui';

export function GeneralSettingsPage({ settings, visibleIds, isSearching }: CategoryPageProps) {
  const { t: ts } = useTranslation('settings');
  const { t: tc } = useTranslation('common');

  const handleCheckNow = async () => {
    const update = await checkForUpdate();
    if (update) {
      useToastStore.getState().addToast(
        tc('update.available', { version: update.version }),
        'info',
        15000,
        {
          label: tc('update.download'),
          action: () => {
            openUrl(update.url).catch(() => window.open(update.url, '_blank', 'noopener'));
          },
        },
      );
    } else {
      useToastStore.getState().addToast(tc('update.upToDate'), 'success');
    }
  };

  return (
    <>
      {(!visibleIds || visibleIds.has('language')) && (
        <SettingRow label={ts('general.language.label')} description={ts('general.language.description')}>
          <select
            value={settings.language}
            onChange={(e) => settings.update({ language: e.target.value })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            <option value="en">English</option>
          </select>
        </SettingRow>
      )}
      {!isSearching && <SubHeader label={ts('general.subheaders.startup')} />}
      {(!visibleIds || visibleIds.has('startupBehavior')) && (
        <SettingRow label={ts('general.onStartup.label')} description={ts('general.onStartup.description')}>
          <select
            value={settings.startupBehavior}
            onChange={(e) => settings.update({ startupBehavior: e.target.value as StartupBehavior })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            <option value="reopen-last">{ts('general.onStartup.reopenLast')}</option>
            <option value="show-picker">{ts('general.onStartup.showPicker')}</option>
          </select>
        </SettingRow>
      )}
      {!isSearching && <SubHeader label={ts('general.subheaders.updates')} />}
      {(!visibleIds || visibleIds.has('checkForUpdates')) && (
        <SettingRow label={ts('general.checkForUpdates.label')} description={ts('general.checkForUpdates.description')}>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCheckNow}>
              {ts('general.checkNow')}
            </Button>
            <ToggleSwitch checked={settings.checkForUpdates} onChange={(v) => settings.update({ checkForUpdates: v })} />
          </div>
        </SettingRow>
      )}
      {(!isSearching || (visibleIds && visibleIds.has('settingsProfile'))) && (
        <ProfileSettingsSection />
      )}
    </>
  );
}
