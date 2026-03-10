import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function LivePreviewOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('livePreviewOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('livePreviewOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('livePreviewOptions.headings.label')} description={ts('livePreviewOptions.headings.description')}>
        <ToggleSwitch
          checked={settings.livePreviewHeadings}
          onChange={(v) => settings.update({ livePreviewHeadings: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.bold.label')} description={ts('livePreviewOptions.bold.description')}>
        <ToggleSwitch
          checked={settings.livePreviewBold}
          onChange={(v) => settings.update({ livePreviewBold: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.italic.label')} description={ts('livePreviewOptions.italic.description')}>
        <ToggleSwitch
          checked={settings.livePreviewItalic}
          onChange={(v) => settings.update({ livePreviewItalic: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.links.label')} description={ts('livePreviewOptions.links.description')}>
        <ToggleSwitch
          checked={settings.livePreviewLinks}
          onChange={(v) => settings.update({ livePreviewLinks: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.images.label')} description={ts('livePreviewOptions.images.description')}>
        <ToggleSwitch
          checked={settings.livePreviewImages}
          onChange={(v) => settings.update({ livePreviewImages: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.codeBlocks.label')} description={ts('livePreviewOptions.codeBlocks.description')}>
        <ToggleSwitch
          checked={settings.livePreviewCodeBlocks}
          onChange={(v) => settings.update({ livePreviewCodeBlocks: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="livepreview-options" />
    </div>
  );
}
