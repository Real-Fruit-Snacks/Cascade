import { useTranslation } from 'react-i18next';
import type { StartupBehavior } from '../../../stores/settings-store';
import { SettingRow } from '../shared/SettingRow';
import { SubHeader } from '../shared/SubHeader';
import type { CategoryPageProps } from '../shared/searchable-items';

export function GeneralSettingsPage({ settings, visibleIds, isSearching }: CategoryPageProps) {
  const { t: ts } = useTranslation('settings');

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
    </>
  );
}
