import { useTranslation } from 'react-i18next';
import type { AccentColor } from '../../../stores/settings-store';

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

interface AccentColorPickerProps {
  value: AccentColor;
  onChange: (v: AccentColor) => void;
}

export function AccentColorPicker({ value, onChange }: AccentColorPickerProps) {
  const { t: ts } = useTranslation('settings');
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
