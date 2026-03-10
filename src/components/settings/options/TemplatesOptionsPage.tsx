import { useTranslation } from 'react-i18next';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';

export function TemplatesOptionsPage(_props: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('templatesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('templatesOptions.description')}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('templatesOptions.availableVariables')}</span>
        <div className="flex flex-col gap-2">
          {([
            ['{{title}}', ts('templatesOptions.variables.title')],
            ['{{date}}', ts('templatesOptions.variables.date')],
            ['{{time}}', ts('templatesOptions.variables.time')],
            ['{{datetime}}', ts('templatesOptions.variables.datetime')],
            ['{{date:FORMAT}}', ts('templatesOptions.variables.dateFormat')],
            ['{{clipboard}}', ts('templatesOptions.variables.clipboard')],
            ['{{cursor}}', ts('templatesOptions.variables.cursor')],
          ] as const).map(([variable, desc]) => (
            <div key={variable} className="flex items-start gap-3">
              <code
                className="px-1.5 py-0.5 rounded text-xs font-mono shrink-0"
                style={{ backgroundColor: 'var(--ctp-crust)', color: 'var(--ctp-accent)', border: '1px solid var(--ctp-surface1)' }}
              >
                {variable}
              </code>
              <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
      <FeatureWiki featureId="templates-options" />
    </div>
  );
}
