import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function TypewriterOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('typewriterOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('typewriterOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('typewriterOptions.verticalOffset.label')} description={ts('typewriterOptions.verticalOffset.description')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={10}
            max={90}
            value={settings.typewriterOffset}
            onChange={(e) => settings.update({ typewriterOffset: Number(e.target.value) })}
            className="flex-1 accent-[var(--ctp-accent)]"
            style={{ maxWidth: 120 }}
          />
          <span className="text-xs w-8 text-right" style={{ color: 'var(--ctp-subtext1)' }}>
            {settings.typewriterOffset}%
          </span>
        </div>
      </SettingRow>
      <FeatureWiki featureId="typewriter-options" />
    </div>
  );
}
