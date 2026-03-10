import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function MediaViewerOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('mediaViewerOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('mediaViewerOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('mediaViewerOptions.pdfDefaultZoom.label')} description={ts('mediaViewerOptions.pdfDefaultZoom.description')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={25}
            max={400}
            step={25}
            value={settings.pdfDefaultZoom}
            onChange={(e) => settings.update({ pdfDefaultZoom: Number(e.target.value) })}
            className="flex-1 accent-[var(--ctp-accent)]"
            style={{ maxWidth: 120 }}
          />
          <span className="text-xs w-10 text-right" style={{ color: 'var(--ctp-subtext1)' }}>
            {settings.pdfDefaultZoom}%
          </span>
        </div>
      </SettingRow>

      <SettingRow label={ts('mediaViewerOptions.imageDefaultZoom.label')} description={ts('mediaViewerOptions.imageDefaultZoom.description')}>
        <select
          value={settings.imageDefaultZoom}
          onChange={(e) => settings.update({ imageDefaultZoom: e.target.value as 'fit' | 'actual' })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value="fit">{ts('mediaViewerOptions.imageDefaultZoom.fitToView')}</option>
          <option value="actual">{ts('mediaViewerOptions.imageDefaultZoom.actualSize')}</option>
        </select>
      </SettingRow>
      <FeatureWiki featureId="mediaviewer-options" />
    </div>
  );
}
