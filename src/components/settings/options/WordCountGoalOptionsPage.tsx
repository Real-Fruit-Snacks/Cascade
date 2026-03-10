import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function WordCountGoalOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('wordCountGoalOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('wordCountGoalOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('wordCountGoalOptions.targetWords.label')} description={ts('wordCountGoalOptions.targetWords.description')}>
        <input
          type="number"
          min={1}
          max={100000}
          step={100}
          value={settings.wordCountGoalTarget}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n > 0) settings.update({ wordCountGoalTarget: n });
          }}
          className="text-xs px-2 py-1 rounded outline-none w-20 text-right"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        />
      </SettingRow>

      <SettingRow label={ts('wordCountGoalOptions.showInStatusBar.label')} description={ts('wordCountGoalOptions.showInStatusBar.description')}>
        <ToggleSwitch
          checked={settings.wordCountGoalShowStatusBar}
          onChange={(v) => settings.update({ wordCountGoalShowStatusBar: v })}
        />
      </SettingRow>

      <SettingRow label={ts('wordCountGoalOptions.notifyOnReach.label')} description={ts('wordCountGoalOptions.notifyOnReach.description')}>
        <ToggleSwitch
          checked={settings.wordCountGoalNotify}
          onChange={(v) => settings.update({ wordCountGoalNotify: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="wordcountgoal-options" />
    </div>
  );
}
