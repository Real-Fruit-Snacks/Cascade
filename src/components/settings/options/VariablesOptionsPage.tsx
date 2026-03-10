import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { Settings } from '../../../stores/settings-store';

export function VariablesOptionsPage({ settings }: { settings: Settings & { update: (partial: Partial<Settings>) => void } }) {
  const { t: ts } = useTranslation('settings');
  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('variablesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('variablesOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('variablesOptions.highlightVariables.label')} description={ts('variablesOptions.highlightVariables.description')}>
        <ToggleSwitch
          checked={settings.variablesHighlight}
          onChange={(v) => settings.update({ variablesHighlight: v })}
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.openDelimiter.label')} description={ts('variablesOptions.openDelimiter.description')}>
        <input
          type="text"
          value={settings.variablesOpenDelimiter}
          onChange={(e) => settings.update({ variablesOpenDelimiter: e.target.value || '<' })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
          placeholder="<"
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.closeDelimiter.label')} description={ts('variablesOptions.closeDelimiter.description')}>
        <input
          type="text"
          value={settings.variablesCloseDelimiter}
          onChange={(e) => settings.update({ variablesCloseDelimiter: e.target.value || '>' })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
          placeholder=">"
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.defaultSeparator.label')} description={ts('variablesOptions.defaultSeparator.description')}>
        <input
          type="text"
          value={settings.variablesDefaultSeparator}
          onChange={(e) => settings.update({ variablesDefaultSeparator: e.target.value || ':' })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
          placeholder=":"
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.missingValueText.label')} description={ts('variablesOptions.missingValueText.description')}>
        <input
          type="text"
          value={settings.variablesMissingText}
          onChange={(e) => settings.update({ variablesMissingText: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none w-24"
          style={inputStyle}
          placeholder="[MISSING]"
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.supportNesting.label')} description={ts('variablesOptions.supportNesting.description')}>
        <ToggleSwitch
          checked={settings.variablesSupportNesting}
          onChange={(v) => settings.update({ variablesSupportNesting: v })}
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.caseInsensitive.label')} description={ts('variablesOptions.caseInsensitive.description')}>
        <ToggleSwitch
          checked={settings.variablesCaseInsensitive}
          onChange={(v) => settings.update({ variablesCaseInsensitive: v })}
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.arraySeparator.label')} description={ts('variablesOptions.arraySeparator.description')}>
        <input
          type="text"
          value={settings.variablesArrayJoinSeparator}
          onChange={(e) => settings.update({ variablesArrayJoinSeparator: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
          placeholder=", "
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.preserveOnMissing.label')} description={ts('variablesOptions.preserveOnMissing.description')}>
        <ToggleSwitch
          checked={settings.variablesPreserveOnMissing}
          onChange={(v) => settings.update({ variablesPreserveOnMissing: v })}
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.sidebarButtonAction.label')} description={ts('variablesOptions.sidebarButtonAction.description')}>
        <select
          value={settings.variablesSidebarAction}
          onChange={(e) => settings.update({ variablesSidebarAction: e.target.value as 'list' | 'menu' })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={inputStyle}
        >
          <option value="list">{ts('variablesOptions.sidebarButtonAction.openList')}</option>
          <option value="menu">{ts('variablesOptions.sidebarButtonAction.showMenu')}</option>
        </select>
      </SettingRow>
      <FeatureWiki featureId="variables-options" />
    </div>
  );
}
