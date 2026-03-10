import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';
import type { AccentColor, IndentGuideStyle } from '../../../stores/settings-store';

export function IndentGuidesOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('indentGuidesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('indentGuidesOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('indentGuidesOptions.guideColor.label')} description={ts('indentGuidesOptions.guideColor.description')}>
        <select
          value={settings.indentGuideColor}
          onChange={(e) => settings.update({ indentGuideColor: e.target.value as AccentColor })}
          className="text-xs px-2 py-1 rounded outline-none capitalize"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          {['rosewater','flamingo','pink','mauve','red','maroon','peach','yellow','green','teal','sky','sapphire','blue','lavender'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label={ts('indentGuidesOptions.guideStyle.label')} description={ts('indentGuidesOptions.guideStyle.description')}>
        <select
          value={settings.indentGuideStyle}
          onChange={(e) => settings.update({ indentGuideStyle: e.target.value as IndentGuideStyle })}
          className="text-xs px-2 py-1 rounded outline-none capitalize"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value="solid">{ts('indentGuidesOptions.guideStyle.solid')}</option>
          <option value="dashed">{ts('indentGuidesOptions.guideStyle.dashed')}</option>
          <option value="dotted">{ts('indentGuidesOptions.guideStyle.dotted')}</option>
        </select>
      </SettingRow>
      <FeatureWiki featureId="indentguides-options" />
    </div>
  );
}
