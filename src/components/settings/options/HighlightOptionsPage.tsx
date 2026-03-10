import { useTranslation } from 'react-i18next';
import { SettingRow } from '../shared/SettingRow';
import { FeatureWiki } from '../../FeatureWiki';
import type { OptionsPageProps } from '../shared/types';
import type { AccentColor } from '../../../stores/settings-store';

function AccentColorPicker({ value, onChange }: { value: AccentColor; onChange: (v: AccentColor) => void }) {
  const { t: ts } = useTranslation('settings');
  const ACCENT_COLORS: { id: AccentColor; labelKey: string }[] = [
    { id: 'mauve', labelKey: 'accentColors.mauve' },
    { id: 'blue', labelKey: 'accentColors.blue' },
    { id: 'pink', labelKey: 'accentColors.pink' },
    { id: 'red', labelKey: 'accentColors.red' },
    { id: 'peach', labelKey: 'accentColors.peach' },
    { id: 'yellow', labelKey: 'accentColors.yellow' },
    { id: 'green', labelKey: 'accentColors.green' },
    { id: 'teal', labelKey: 'accentColors.teal' },
    { id: 'sky', labelKey: 'accentColors.sky' },
    { id: 'lavender', labelKey: 'accentColors.lavender' },
    { id: 'flamingo', labelKey: 'accentColors.flamingo' },
    { id: 'rosewater', labelKey: 'accentColors.rosewater' },
  ];
  return (
    <div className="flex items-center gap-1">
      {ACCENT_COLORS.map(({ id, labelKey }) => (
        <button
          key={id}
          className="w-5 h-5 rounded-full transition-transform hover:scale-110"
          style={{
            backgroundColor: `var(--ctp-${id})`,
            outline: value === id ? '2px solid var(--ctp-text)' : undefined,
            outlineOffset: 1,
          }}
          title={ts(labelKey)}
          onClick={() => onChange(id)}
        />
      ))}
    </div>
  );
}

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
