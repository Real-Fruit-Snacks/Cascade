import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function TagsOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('tagsOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('tagsOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('tagsOptions.autoComplete.label')} description={ts('tagsOptions.autoComplete.description')}>
        <ToggleSwitch
          checked={settings.tagsAutoComplete}
          onChange={(v) => settings.update({ tagsAutoComplete: v })}
        />
      </SettingRow>

      <SettingRow label={ts('tagsOptions.nestedTags.label')} description={ts('tagsOptions.nestedTags.description')}>
        <ToggleSwitch
          checked={settings.tagsNestedSupport}
          onChange={(v) => settings.update({ tagsNestedSupport: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="tags-options" />
    </div>
  );
}
