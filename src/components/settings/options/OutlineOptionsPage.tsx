import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function OutlineOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('outlineOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('outlineOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('outlineOptions.minHeadingLevel.label')} description={ts('outlineOptions.minHeadingLevel.description')}>
        <select
          value={settings.outlineMinLevel}
          onChange={(e) => settings.update({ outlineMinLevel: Number(e.target.value) })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={inputStyle}
        >
          <option value={1}>{ts('outlineOptions.minHeadingLevel.h1')}</option>
          <option value={2}>{ts('outlineOptions.minHeadingLevel.h2')}</option>
          <option value={3}>{ts('outlineOptions.minHeadingLevel.h3')}</option>
          <option value={4}>{ts('outlineOptions.minHeadingLevel.h4')}</option>
          <option value={5}>{ts('outlineOptions.minHeadingLevel.h5')}</option>
          <option value={6}>{ts('outlineOptions.minHeadingLevel.h6')}</option>
        </select>
      </SettingRow>

      <SettingRow label={ts('outlineOptions.autoExpand.label')} description={ts('outlineOptions.autoExpand.description')}>
        <ToggleSwitch
          checked={settings.outlineAutoExpand}
          onChange={(v) => settings.update({ outlineAutoExpand: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="outline-options" />
    </div>
  );
}
