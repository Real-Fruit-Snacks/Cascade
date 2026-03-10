import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function BacklinksOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('backlinksOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('backlinksOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('backlinksOptions.contextLines.label')} description={ts('backlinksOptions.contextLines.description')}>
        <input
          type="number"
          min={0}
          max={5}
          value={settings.backlinksContextLines}
          onChange={(e) => settings.update({ backlinksContextLines: Math.max(0, Math.min(5, Number(e.target.value) || 2)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('backlinksOptions.groupByFolder.label')} description={ts('backlinksOptions.groupByFolder.description')}>
        <ToggleSwitch
          checked={settings.backlinksGroupByFolder}
          onChange={(v) => settings.update({ backlinksGroupByFolder: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="backlinks-options" />
    </div>
  );
}
