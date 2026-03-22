import { COLOR_META } from './color-meta';

interface ColorSwatchProps {
  colorKey: string;
  value: string;
  isActive: boolean;
  onClick: () => void;
}

export function ColorSwatch({ colorKey, value, isActive, onClick }: ColorSwatchProps) {
  const meta = COLOR_META[colorKey];
  if (!meta) return null;

  const isAccent = meta.category === 'accents';

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 shrink-0 transition-transform"
      style={{ transform: isActive ? 'scale(1.15)' : 'scale(1)', height: 50 }}
      title={`${meta.label} — ${meta.description}`}
      aria-label={`Edit ${meta.label} color: ${value}`}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: isAccent ? '50%' : 6,
          backgroundColor: value,
          border: isActive ? '2px solid var(--ctp-accent)' : '1px solid var(--ctp-surface2)',
          boxShadow: isActive ? '0 0 0 2px var(--ctp-base)' : 'none',
        }}
      />
      <span
        className="text-center leading-tight"
        style={{
          fontSize: 9,
          color: isActive ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)',
          width: 52,
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        {meta.label}
      </span>
    </button>
  );
}
