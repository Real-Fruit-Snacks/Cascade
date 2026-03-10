import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function CodeFoldingOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('codeFoldingOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('codeFoldingOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('codeFoldingOptions.foldHeadings.label')} description={ts('codeFoldingOptions.foldHeadings.description')}>
        <ToggleSwitch
          checked={settings.foldHeadings}
          onChange={(v) => settings.update({ foldHeadings: v })}
        />
      </SettingRow>

      <SettingRow label={ts('codeFoldingOptions.foldCodeBlocks.label')} description={ts('codeFoldingOptions.foldCodeBlocks.description')}>
        <ToggleSwitch
          checked={settings.foldCodeBlocks}
          onChange={(v) => settings.update({ foldCodeBlocks: v })}
        />
      </SettingRow>

      <SettingRow label={ts('codeFoldingOptions.minFoldLevel.label')} description={ts('codeFoldingOptions.minFoldLevel.description')}>
        <select
          value={settings.foldMinLevel}
          onChange={(e) => settings.update({ foldMinLevel: Number(e.target.value) })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value={1}>{ts('codeFoldingOptions.minFoldLevel.h1')}</option>
          <option value={2}>{ts('codeFoldingOptions.minFoldLevel.h2')}</option>
          <option value={3}>{ts('codeFoldingOptions.minFoldLevel.h3')}</option>
          <option value={4}>{ts('codeFoldingOptions.minFoldLevel.h4')}</option>
          <option value={5}>{ts('codeFoldingOptions.minFoldLevel.h5')}</option>
          <option value={6}>{ts('codeFoldingOptions.minFoldLevel.h6')}</option>
        </select>
      </SettingRow>
      <FeatureWiki featureId="codefolding-options" />
    </div>
  );
}
