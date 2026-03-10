import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function SearchOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('searchOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('searchOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('searchOptions.caseSensitive.label')} description={ts('searchOptions.caseSensitive.description')}>
        <ToggleSwitch
          checked={settings.searchCaseSensitive}
          onChange={(v) => settings.update({ searchCaseSensitive: v })}
        />
      </SettingRow>

      <SettingRow label={ts('searchOptions.useRegex.label')} description={ts('searchOptions.useRegex.description')}>
        <ToggleSwitch
          checked={settings.searchRegex}
          onChange={(v) => settings.update({ searchRegex: v })}
        />
      </SettingRow>

      <SettingRow label={ts('searchOptions.wholeWord.label')} description={ts('searchOptions.wholeWord.description')}>
        <ToggleSwitch
          checked={settings.searchWholeWord}
          onChange={(v) => settings.update({ searchWholeWord: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="search-options" />
    </div>
  );
}
