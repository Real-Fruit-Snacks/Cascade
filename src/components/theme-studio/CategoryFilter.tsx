import { useThemeStudioStore, type ThemeStudioCategory } from '../../stores/theme-studio-store';
import { CATEGORIES } from './color-meta';

export function CategoryFilter() {
  const activeCategory = useThemeStudioStore((s) => s.activeCategory);
  const setCategory = useThemeStudioStore((s) => s.setCategory);

  return (
    <div className="flex items-center gap-1">
      {CATEGORIES.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => setCategory(id as ThemeStudioCategory)}
          className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
          style={{
            backgroundColor: activeCategory === id ? 'var(--ctp-accent)' : 'var(--ctp-surface1)',
            color: activeCategory === id ? 'var(--ctp-base)' : 'var(--ctp-subtext0)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
