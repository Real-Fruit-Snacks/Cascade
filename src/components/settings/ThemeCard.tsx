import { Trash2 } from 'lucide-react';
import type { FlavorColors } from '../../styles/catppuccin-flavors';

interface ThemeCardProps {
  themeId: string;
  label: string;
  colors: FlavorColors;
  isSelected: boolean;
  isCustom?: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ThemeCard({ themeId, label, colors, isSelected, isCustom, onSelect, onDelete }: ThemeCardProps) {
  return (
    <div
      className="group relative rounded-md overflow-hidden cursor-pointer transition-all hover:brightness-110"
      style={{
        border: isSelected
          ? '2px solid var(--ctp-accent)'
          : `1px solid ${colors.surface2}`,
        padding: isSelected ? '0px' : '1px',
      }}
      onClick={() => onSelect(themeId)}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(themeId);
        }
      }}
    >
      <div
        style={{
          backgroundColor: colors.base,
          padding: '8px',
          fontFamily: "'Courier New', Consolas, monospace",
          fontSize: '9px',
          lineHeight: 1.5,
        }}
      >
        <div
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '10px',
            fontWeight: 500,
            color: colors.text,
            marginBottom: '4px',
          }}
        >
          {label}
        </div>
        <div>
          <span style={{ color: colors.mauve }}>const</span>{' '}
          <span style={{ color: colors.blue }}>name</span>{' '}
          <span style={{ color: colors.sky }}>=</span>{' '}
          <span style={{ color: colors.green }}>&quot;hello&quot;</span>
        </div>
        <div>
          <span style={{ color: colors.mauve }}>if</span>{' '}
          <span style={{ color: colors.text }}>(name)</span>{' '}
          <span style={{ color: colors.sky }}>{'{'}</span>
        </div>
        <div>
          {'  '}
          <span style={{ color: colors.blue }}>log</span>
          <span style={{ color: colors.text }}>(</span>
          <span style={{ color: colors.peach }}>42</span>
          <span style={{ color: colors.text }}>)</span>
        </div>
        <div>
          <span style={{ color: colors.sky }}>{'}'}</span>
        </div>
      </div>
      {isCustom && onDelete && (
        <button
          className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            backgroundColor: colors.surface0,
            color: colors.red,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(themeId);
          }}
          title="Delete theme"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
