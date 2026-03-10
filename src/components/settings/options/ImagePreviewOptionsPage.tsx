import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function ImagePreviewOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('imagePreviewOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('imagePreviewOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('imagePreviewOptions.maxHeight.label')} description={ts('imagePreviewOptions.maxHeight.description')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={100}
            max={800}
            step={50}
            value={settings.imagePreviewMaxHeight}
            onChange={(e) => settings.update({ imagePreviewMaxHeight: Number(e.target.value) })}
            className="flex-1 accent-[var(--ctp-accent)]"
            style={{ maxWidth: 120 }}
          />
          <span className="text-xs w-10 text-right" style={{ color: 'var(--ctp-subtext1)' }}>
            {settings.imagePreviewMaxHeight}px
          </span>
        </div>
      </SettingRow>
      <FeatureWiki featureId="imagepreview-options" />
    </div>
  );
}
