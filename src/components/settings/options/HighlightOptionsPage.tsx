import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { AccentColorPicker } from '../shared/AccentColorPicker';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function HighlightOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('highlightOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('highlightOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('highlightOptions.highlightColor.label')} description={ts('highlightOptions.highlightColor.description')}>
        <AccentColorPicker value={settings.highlightColor} onChange={(v) => settings.update({ highlightColor: v })} />
      </SettingRow>
      <FeatureWiki featureId="highlight-options" />
    </div>
  );
}
