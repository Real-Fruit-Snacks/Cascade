import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function PropertiesOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('propertiesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('propertiesOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('propertiesOptions.showTypes.label')} description={ts('propertiesOptions.showTypes.description')}>
        <ToggleSwitch
          checked={settings.propertiesShowTypes}
          onChange={(v) => settings.update({ propertiesShowTypes: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="properties-options" />
    </div>
  );
}
