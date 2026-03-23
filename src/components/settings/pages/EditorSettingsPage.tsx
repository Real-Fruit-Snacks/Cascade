import { useTranslation } from 'react-i18next';
import { DEFAULTS } from '../../../stores/settings-store';
import type { ViewMode } from '../../../types/index';
import { FONT_OPTIONS, fontLabel } from '../shared/constants';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { SubHeader } from '../shared/SubHeader';
import type { CategoryPageProps } from '../shared/searchable-items';

export function EditorSettingsPage({ settings, visibleIds, isSearching }: CategoryPageProps) {
  const { t: ts } = useTranslation('settings');

  return (
    <>
      {!isSearching && <SubHeader label={ts('editor.subheaders.text')} />}
      {(!visibleIds || visibleIds.has('fontSize')) && (
        <SettingRow label={ts('editor.fontSize.label')} description={ts('editor.fontSize.description')} onReset={settings.fontSize !== DEFAULTS.fontSize ? () => settings.update({ fontSize: DEFAULTS.fontSize }) : undefined}>
          <select
            value={settings.fontSize}
            onChange={(e) => settings.update({ fontSize: Number(e.target.value) })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            {Array.from({ length: 15 }, (_, i) => i + 10).map((size) => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('fontFamily')) && (
        <SettingRow label={ts('editor.fontFamily.label')} description={ts('editor.fontFamily.description')}>
          <select
            value={settings.fontFamily}
            onChange={(e) => settings.update({ fontFamily: e.target.value })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>{fontLabel(f)}</option>
            ))}
          </select>
        </SettingRow>
      )}
      {!isSearching && <SubHeader label={ts('editor.subheaders.display')} />}
      {(!visibleIds || visibleIds.has('lineNumbers')) && (
        <SettingRow label={ts('editor.lineNumbers.label')} description={ts('editor.lineNumbers.description')}>
          <ToggleSwitch
            checked={settings.showLineNumbers}
            onChange={(v) => settings.update({ showLineNumbers: v })}
          />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('readableLineLength')) && (
        <SettingRow label={ts('editor.readableLineLength.label')} description={ts('editor.readableLineLength.description')}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={2000}
              step={50}
              value={settings.readableLineLength}
              onChange={(e) => settings.update({ readableLineLength: Number(e.target.value) })}
              className="w-28 accent-[var(--ctp-accent)]"
            />
            <span className="text-xs w-12 text-right ctp-subtext0">
              {settings.readableLineLength === 0 ? ts('editor.readableLineLength.off') : `${settings.readableLineLength}px`}
            </span>
          </div>
        </SettingRow>
      )}
      {!isSearching && <SubHeader label={ts('editor.subheaders.editing')} />}
      {(!visibleIds || visibleIds.has('vimMode')) && (
        <SettingRow label={ts('editor.vimMode.label')} description={ts('editor.vimMode.description')}>
          <ToggleSwitch
            checked={settings.vimMode}
            onChange={(v) => settings.update({ vimMode: v })}
          />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('tabSize')) && (
        <SettingRow label={ts('editor.tabSize.label')} description={ts('editor.tabSize.description')}>
          <select
            value={settings.tabSize}
            onChange={(e) => settings.update({ tabSize: Number(e.target.value) })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            <option value={2}>{ts('editor.tabSize.twoSpaces')}</option>
            <option value={4}>{ts('editor.tabSize.fourSpaces')}</option>
          </select>
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('highlightActiveLine')) && (
        <SettingRow label={ts('editor.highlightActiveLine.label')} description={ts('editor.highlightActiveLine.description')}>
          <ToggleSwitch
            checked={settings.highlightActiveLine}
            onChange={(v) => settings.update({ highlightActiveLine: v })}
          />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('defaultViewMode')) && (
        <SettingRow label={ts('editor.defaultViewMode.label')} description={ts('editor.defaultViewMode.description')}>
          <select
            value={settings.defaultViewMode}
            onChange={(e) => settings.update({ defaultViewMode: e.target.value as ViewMode })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            <option value="live">{ts('editor.defaultViewMode.live')}</option>
            <option value="source">{ts('editor.defaultViewMode.source')}</option>
            <option value="reading">{ts('editor.defaultViewMode.reading')}</option>
          </select>
        </SettingRow>
      )}
      {!isSearching && <SubHeader label={ts('editor.subheaders.other')} />}
      {(!visibleIds || visibleIds.has('codeBlockLineNumbers')) && (
        <SettingRow label={ts('editor.codeBlockLineNumbers.label')} description={ts('editor.codeBlockLineNumbers.description')}>
          <ToggleSwitch
            checked={settings.codeBlockLineNumbers}
            onChange={(v) => settings.update({ codeBlockLineNumbers: v })}
          />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('pasteUrlIntoSelection')) && (
        <SettingRow label={ts('editor.pasteUrlIntoSelection.label')} description={ts('editor.pasteUrlIntoSelection.description')}>
          <ToggleSwitch
            checked={settings.pasteUrlIntoSelection}
            onChange={(v) => settings.update({ pasteUrlIntoSelection: v })}
          />
        </SettingRow>
      )}
    </>
  );
}
