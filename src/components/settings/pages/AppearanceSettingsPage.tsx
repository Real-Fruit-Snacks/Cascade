import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { SubHeader } from '../shared/SubHeader';
import { AccentColorPicker } from '../shared/AccentColorPicker';
import { UiFontSizeSlider } from '../shared/UiFontSizeSlider';
import { ThemeCardGrid } from '../ThemeCardGrid';
import { CommunityThemesSection } from '../marketplace';
import type { CategoryPageProps } from '../shared/searchable-items';
import type { CustomTheme } from '../../../styles/catppuccin-flavors';

interface AppearanceSettingsPageProps extends CategoryPageProps {
  customThemesList: CustomTheme[];
  loadCustomThemes: () => void;
}

export function AppearanceSettingsPage({ settings, visibleIds, isSearching, customThemesList, loadCustomThemes }: AppearanceSettingsPageProps) {
  const { t: ts } = useTranslation('settings');

  return (
    <>
      {!isSearching && <SubHeader label={ts('appearance.subheaders.theme')} />}
      {(!visibleIds || visibleIds.has('theme')) && (
        <ThemeCardGrid
          customThemesList={customThemesList}
          loadCustomThemes={loadCustomThemes}
        />
      )}
      {!isSearching && <SubHeader label={ts('appearance.subheaders.colors')} />}
      {(!visibleIds || visibleIds.has('accentColor')) && (
        <SettingRow label={ts('appearance.accentColor.label')} description={ts('appearance.accentColor.description')}>
          <AccentColorPicker
            value={settings.accentColor}
            onChange={(v) => settings.update({ accentColor: v })}
          />
        </SettingRow>
      )}
      {!isSearching && <SubHeader label={ts('appearance.subheaders.layout')} />}
      {(!visibleIds || visibleIds.has('sidebarPosition')) && (
        <SettingRow label={ts('appearance.sidebarPosition.label')} description={ts('appearance.sidebarPosition.description')}>
          <select
            value={settings.sidebarPosition}
            onChange={(e) => settings.update({ sidebarPosition: e.target.value as 'left' | 'right' })}
            className="text-xs px-2 py-1 rounded outline-none ctp-input"
          >
            <option value="left">{ts('appearance.sidebarPosition.left')}</option>
            <option value="right">{ts('appearance.sidebarPosition.right')}</option>
          </select>
        </SettingRow>
      )}
      {(!visibleIds || visibleIds.has('uiFontSize')) && (
        <SettingRow label={ts('appearance.uiFontSize.label')} description={ts('appearance.uiFontSize.description')}>
          <UiFontSizeSlider value={settings.uiFontSize} onCommit={(v) => settings.update({ uiFontSize: v })} />
        </SettingRow>
      )}
      {!isSearching && <CommunityThemesSection />}
    </>
  );
}
