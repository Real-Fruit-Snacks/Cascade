import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function WikiLinksOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('wikiLinksOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('wikiLinksOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('wikiLinksOptions.openInNewTab.label')} description={ts('wikiLinksOptions.openInNewTab.description')}>
        <ToggleSwitch
          checked={settings.wikiLinksOpenInNewTab}
          onChange={(v) => settings.update({ wikiLinksOpenInNewTab: v })}
        />
      </SettingRow>

      <SettingRow label={ts('wikiLinksOptions.showFullPath.label')} description={ts('wikiLinksOptions.showFullPath.description')}>
        <ToggleSwitch
          checked={settings.wikiLinksShowFullPath}
          onChange={(v) => settings.update({ wikiLinksShowFullPath: v })}
        />
      </SettingRow>

      <SettingRow label={ts('wikiLinksOptions.createOnFollow.label')} description={ts('wikiLinksOptions.createOnFollow.description')}>
        <ToggleSwitch
          checked={settings.wikiLinksCreateOnFollow}
          onChange={(v) => settings.update({ wikiLinksCreateOnFollow: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="wikilinks-options" />
    </div>
  );
}
