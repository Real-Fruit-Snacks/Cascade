import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function TocOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('tocOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('tocOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('tocOptions.autoUpdateOnSave.label')} description={ts('tocOptions.autoUpdateOnSave.description')}>
        <ToggleSwitch
          checked={settings.tocAutoUpdate}
          onChange={(v) => settings.update({ tocAutoUpdate: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="toc-options" />
    </div>
  );
}
