import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';
import type { Settings } from '../../../stores/settings-store';

export function DailyNotesOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('dailyNotesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('dailyNotesOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('dailyNotesOptions.notesFolder.label')} description={ts('dailyNotesOptions.notesFolder.description')}>
        <input
          type="text"
          value={settings.dailyNotesFolder}
          onChange={(e) => settings.update({ dailyNotesFolder: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none w-32"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
          placeholder={ts('dailyNotesOptions.notesFolder.placeholder')}
        />
      </SettingRow>

      <SettingRow label={ts('dailyNotesOptions.dateFormat.label')} description={ts('dailyNotesOptions.dateFormat.description')}>
        <select
          value={settings.dailyNotesFormat}
          onChange={(e) => settings.update({ dailyNotesFormat: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          <option value="DD-MM-YYYY">DD-MM-YYYY</option>
          <option value="MM-DD-YYYY">MM-DD-YYYY</option>
          <option value="YYYYMMDD">YYYYMMDD</option>
        </select>
      </SettingRow>

      <SettingRow label={ts('dailyNotesOptions.templateFile.label')} description={ts('dailyNotesOptions.templateFile.description')}>
        <input
          type="text"
          value={settings.dailyNotesTemplate}
          onChange={(e) => settings.update({ dailyNotesTemplate: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none w-40"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
          placeholder={ts('dailyNotesOptions.templateFile.placeholder')}
        />
      </SettingRow>

      {/* Periodic Notes */}
      {([
        { label: ts('dailyNotesOptions.periodicNotes.weekly'), prefix: 'weeklyNotes' as const, defaultFolder: 'weekly', formats: ['YYYY-[W]WW', 'GGGG-[W]WW'] },
        { label: ts('dailyNotesOptions.periodicNotes.monthly'), prefix: 'monthlyNotes' as const, defaultFolder: 'monthly', formats: ['YYYY-MM', 'MM-YYYY'] },
        { label: ts('dailyNotesOptions.periodicNotes.quarterly'), prefix: 'quarterlyNotes' as const, defaultFolder: 'quarterly', formats: ['YYYY-[Q]Q', '[Q]Q-YYYY'] },
        { label: ts('dailyNotesOptions.periodicNotes.yearly'), prefix: 'yearlyNotes' as const, defaultFolder: 'yearly', formats: ['YYYY', '[Y]YYYY'] },
      ] as const).map(({ label, prefix, defaultFolder, formats }) => (
        <div key={prefix}>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2 mt-3" style={{ color: 'var(--ctp-accent)' }}>
            {ts('dailyNotesOptions.periodicNotes.notesLabel', { period: label })}
          </div>
          <div className="flex flex-col gap-3">
            <SettingRow label={ts('dailyNotesOptions.periodicNotes.folder.label')} description={ts('dailyNotesOptions.periodicNotes.folder.description', { period: label.toLowerCase() })}>
              <input
                type="text"
                value={settings[`${prefix}Folder`]}
                onChange={(e) => settings.update({ [`${prefix}Folder`]: e.target.value } as Partial<Settings>)}
                className="text-xs px-2 py-1 rounded outline-none w-32"
                style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface2)' }}
                placeholder={defaultFolder}
              />
            </SettingRow>
            <SettingRow label={ts('dailyNotesOptions.periodicNotes.format.label')} description={ts('dailyNotesOptions.periodicNotes.format.description', { period: label.toLowerCase() })}>
              <select
                value={settings[`${prefix}Format`]}
                onChange={(e) => settings.update({ [`${prefix}Format`]: e.target.value } as Partial<Settings>)}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface2)' }}
              >
                {formats.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </SettingRow>
            <SettingRow label={ts('dailyNotesOptions.periodicNotes.template.label')} description={ts('dailyNotesOptions.periodicNotes.template.description', { period: label.toLowerCase() })}>
              <input
                type="text"
                value={settings[`${prefix}Template`]}
                onChange={(e) => settings.update({ [`${prefix}Template`]: e.target.value } as Partial<Settings>)}
                className="text-xs px-2 py-1 rounded outline-none w-40"
                style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface2)' }}
                placeholder={`templates/${label.toLowerCase()}.md`}
              />
            </SettingRow>
          </div>
        </div>
      ))}
      <FeatureWiki featureId="dailynotes-options" />
    </div>
  );
}
