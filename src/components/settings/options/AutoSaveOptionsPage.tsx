import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';
import type { AutoSaveMode } from '../../../stores/settings-store';

export function AutoSaveOptionsPage({ settings, intervalValue, setIntervalValue, commitInterval }: OptionsPageProps & { intervalValue: string; setIntervalValue: (v: string) => void; commitInterval: () => void }) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('autoSaveOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('autoSaveOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('autoSaveOptions.saveMode.label')} description={ts('autoSaveOptions.saveMode.description')}>
        <select
          value={settings.autoSaveMode}
          onChange={(e) => settings.update({ autoSaveMode: e.target.value as AutoSaveMode })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value="focus-change">{ts('autoSaveOptions.saveMode.focusChange')}</option>
          <option value="timer">{ts('autoSaveOptions.saveMode.timer')}</option>
        </select>
      </SettingRow>

      {settings.autoSaveMode === 'timer' && (
        <SettingRow label={ts('autoSaveOptions.saveInterval.label')} description={ts('autoSaveOptions.saveInterval.description')}>
          <input
            type="number"
            min={500}
            max={30000}
            step={100}
            value={intervalValue}
            onChange={(e) => setIntervalValue(e.target.value)}
            onBlur={commitInterval}
            onKeyDown={(e) => { if (e.key === 'Enter') commitInterval(); }}
            className="text-xs px-2 py-1 rounded outline-none w-20 text-right"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface2)',
            }}
          />
        </SettingRow>
      )}
      <FeatureWiki featureId="autosave-options" />
    </div>
  );
}
