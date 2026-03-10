import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function StatusBarOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('statusBarOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('statusBarOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('statusBarOptions.wordCount.label')} description={ts('statusBarOptions.wordCount.description')}>
        <ToggleSwitch
          checked={settings.statusBarWords}
          onChange={(v) => settings.update({ statusBarWords: v })}
        />
      </SettingRow>

      <SettingRow label={ts('statusBarOptions.characterCount.label')} description={ts('statusBarOptions.characterCount.description')}>
        <ToggleSwitch
          checked={settings.statusBarChars}
          onChange={(v) => settings.update({ statusBarChars: v })}
        />
      </SettingRow>

      <SettingRow label={ts('statusBarOptions.readingTime.label')} description={ts('statusBarOptions.readingTime.description')}>
        <ToggleSwitch
          checked={settings.statusBarReadingTime}
          onChange={(v) => settings.update({ statusBarReadingTime: v })}
        />
      </SettingRow>

      <SettingRow label={ts('statusBarOptions.selectionStats.label')} description={ts('statusBarOptions.selectionStats.description')}>
        <ToggleSwitch
          checked={settings.statusBarSelection}
          onChange={(v) => settings.update({ statusBarSelection: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="statusbar-options" />
    </div>
  );
}
