import { useTranslation } from 'react-i18next';
import type { FolderColorStyle } from '../../../stores/settings-store';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { CategoryPageProps } from '../shared/searchable-items';

export function FolderColorsSettingsPage({ settings, visibleIds }: CategoryPageProps) {
  const { t: ts } = useTranslation('settings');

  return (
    <>
      {(!visibleIds || visibleIds.has('folderColorSubfolders')) && (
        <SettingRow label={ts('folderColors.colorSubfolders.label')} description={ts('folderColors.colorSubfolders.description')}>
          <ToggleSwitch checked={settings.folderColorSubfolders} onChange={(v) => settings.update({ folderColorSubfolders: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('folderColorFiles')) && (
        <SettingRow label={ts('folderColors.colorFiles.label')} description={ts('folderColors.colorFiles.description')}>
          <ToggleSwitch checked={settings.folderColorFiles} onChange={(v) => settings.update({ folderColorFiles: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('folderColorStyle')) && (
        <SettingRow label={ts('folderColors.folderStyle.label')} description={ts('folderColors.folderStyle.description')}>
          <select
            value={settings.folderColorStyle}
            onChange={(e) => settings.update({ folderColorStyle: e.target.value as FolderColorStyle })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            <option value="icon-only">{ts('folderColors.folderStyle.iconOnly')}</option>
            <option value="text">{ts('folderColors.folderStyle.text')}</option>
            <option value="background">{ts('folderColors.folderStyle.background')}</option>
            <option value="accent-bar">{ts('folderColors.folderStyle.accentBar')}</option>
            <option value="full">{ts('folderColors.folderStyle.full')}</option>
            <option value="dot">{ts('folderColors.folderStyle.dot')}</option>
            <option value="custom">{ts('folderColors.folderStyle.custom')}</option>
          </select>
        </SettingRow>
      )}
      {settings.folderColorStyle === 'custom' && (
        <>
          {(!visibleIds || visibleIds.has('folderColorIcon')) && (
            <SettingRow label={ts('folderColors.colorFolderIcon.label')} description={ts('folderColors.colorFolderIcon.description')}>
              <ToggleSwitch checked={settings.folderColorIcon} onChange={(v) => settings.update({ folderColorIcon: v })} />
            </SettingRow>
          )}
          {(!visibleIds || visibleIds.has('folderColorName')) && (
            <SettingRow label={ts('folderColors.colorFolderName.label')} description={ts('folderColors.colorFolderName.description')}>
              <ToggleSwitch checked={settings.folderColorName} onChange={(v) => settings.update({ folderColorName: v })} />
            </SettingRow>
          )}
          {(!visibleIds || visibleIds.has('folderColorBackground')) && (
            <SettingRow label={ts('folderColors.colorFolderBackground.label')} description={ts('folderColors.colorFolderBackground.description')}>
              <ToggleSwitch checked={settings.folderColorBackground} onChange={(v) => settings.update({ folderColorBackground: v })} />
            </SettingRow>
          )}
          {(!visibleIds || visibleIds.has('folderColorChevron')) && (
            <SettingRow label={ts('folderColors.colorChevron.label')} description={ts('folderColors.colorChevron.description')}>
              <ToggleSwitch checked={settings.folderColorChevron} onChange={(v) => settings.update({ folderColorChevron: v })} />
            </SettingRow>
          )}
        </>
      )}
      {(!visibleIds || visibleIds.has('folderColorFileStyle')) && (
        <SettingRow label={ts('folderColors.fileStyle.label')} description={ts('folderColors.fileStyle.description')}>
          <select
            value={settings.folderColorFileStyle}
            onChange={(e) => settings.update({ folderColorFileStyle: e.target.value as FolderColorStyle })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            <option value="icon-only">{ts('folderColors.fileStyle.iconOnly')}</option>
            <option value="text">{ts('folderColors.fileStyle.text')}</option>
            <option value="background">{ts('folderColors.fileStyle.background')}</option>
            <option value="accent-bar">{ts('folderColors.fileStyle.accentBar')}</option>
            <option value="full">{ts('folderColors.fileStyle.full')}</option>
            <option value="dot">{ts('folderColors.fileStyle.dot')}</option>
            <option value="custom">{ts('folderColors.fileStyle.custom')}</option>
          </select>
        </SettingRow>
      )}
      {settings.folderColorFileStyle === 'custom' && (
        <>
          {(!visibleIds || visibleIds.has('folderColorFileIcon')) && (
            <SettingRow label={ts('folderColors.colorFileIcon.label')} description={ts('folderColors.colorFileIcon.description')}>
              <ToggleSwitch checked={settings.folderColorFileIcon} onChange={(v) => settings.update({ folderColorFileIcon: v })} />
            </SettingRow>
          )}
          {(!visibleIds || visibleIds.has('folderColorFileName')) && (
            <SettingRow label={ts('folderColors.colorFileName.label')} description={ts('folderColors.colorFileName.description')}>
              <ToggleSwitch checked={settings.folderColorFileName} onChange={(v) => settings.update({ folderColorFileName: v })} />
            </SettingRow>
          )}
          {(!visibleIds || visibleIds.has('folderColorFileBackground')) && (
            <SettingRow label={ts('folderColors.colorFileBackground.label')} description={ts('folderColors.colorFileBackground.description')}>
              <ToggleSwitch checked={settings.folderColorFileBackground} onChange={(v) => settings.update({ folderColorFileBackground: v })} />
            </SettingRow>
          )}
        </>
      )}
      {(!visibleIds || visibleIds.has('folderColorBold')) && (
        <SettingRow label={ts('folderColors.boldFolderNames.label')} description={ts('folderColors.boldFolderNames.description')}>
          <ToggleSwitch checked={settings.folderColorBold} onChange={(v) => settings.update({ folderColorBold: v })} />
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('folderColorOpacity')) && (
        <SettingRow label={ts('folderColors.colorIntensity.label')} description={ts('folderColors.colorIntensity.description')}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.05}
              value={settings.folderColorOpacity}
              onChange={(e) => settings.update({ folderColorOpacity: Number(e.target.value) })}
              className="flex-1 accent-[var(--ctp-accent)] max-w-[120px]"
            />
            <span className="text-xs w-8 text-right ctp-subtext1">
              {Math.round(settings.folderColorOpacity * 100)}%
            </span>
          </div>
        </SettingRow>
      )}
      <FeatureWiki featureId="folder-colors" />
    </>
  );
}
