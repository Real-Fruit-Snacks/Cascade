import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function FocusModeOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('focusModeOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('focusModeOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('focusModeOptions.dimParagraphs.label')} description={ts('focusModeOptions.dimParagraphs.description')}>
        <ToggleSwitch
          checked={settings.focusModeDimParagraphs}
          onChange={(v) => settings.update({ focusModeDimParagraphs: v })}
        />
      </SettingRow>

      <SettingRow label={ts('focusModeOptions.typewriterScrolling.label')} description={ts('focusModeOptions.typewriterScrolling.description')}>
        <ToggleSwitch
          checked={settings.focusModeTypewriter}
          onChange={(v) => settings.update({ focusModeTypewriter: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="focusmode-options" />
    </div>
  );
}
