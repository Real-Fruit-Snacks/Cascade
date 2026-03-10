import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function GraphOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('graphOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('graphOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('graphOptions.nodeSize.label')} description={ts('graphOptions.nodeSize.description')}>
        <input
          type="number"
          min={1}
          max={20}
          value={settings.graphNodeSize}
          onChange={(e) => settings.update({ graphNodeSize: Math.max(1, Math.min(20, Number(e.target.value) || 6)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('graphOptions.linkDistance.label')} description={ts('graphOptions.linkDistance.description')}>
        <input
          type="number"
          min={20}
          max={300}
          value={settings.graphLinkDistance}
          onChange={(e) => settings.update({ graphLinkDistance: Math.max(20, Math.min(300, Number(e.target.value) || 80)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('graphOptions.showOrphans.label')} description={ts('graphOptions.showOrphans.description')}>
        <ToggleSwitch
          checked={settings.graphShowOrphans}
          onChange={(v) => settings.update({ graphShowOrphans: v })}
        />
      </SettingRow>

      <SettingRow label={ts('graphOptions.maxNodes.label')} description={ts('graphOptions.maxNodes.description')}>
        <input
          type="number"
          min={50}
          max={2000}
          step={50}
          value={settings.graphMaxNodes}
          onChange={(e) => settings.update({ graphMaxNodes: Math.max(50, Math.min(2000, Number(e.target.value) || 500)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>
      <FeatureWiki featureId="graph-options" />
    </div>
  );
}
