import { useTranslation } from 'react-i18next';
import { ThemeCard } from './ThemeCard';
import { flavors, flavorLabels, THEME_GROUPS, registerCustomTheme, unregisterCustomTheme } from '../../styles/catppuccin-flavors';
import type { CustomTheme, FlavorColors } from '../../styles/catppuccin-flavors';
import { useSettingsStore } from '../../stores/settings-store';
import { useVaultStore } from '../../stores/vault-store';
import { useToastStore } from '../../stores/toast-store';
import { saveCustomTheme, deleteCustomTheme } from '../../lib/tauri-commands';

interface ThemeCardGridProps {
  customThemesList: CustomTheme[];
  loadCustomThemes: () => void;
}

export function ThemeCardGrid({ customThemesList, loadCustomThemes }: ThemeCardGridProps) {
  const { t: ts } = useTranslation('settings');
  const settings = useSettingsStore();
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const addToast = useToastStore((s) => s.addToast);

  const handleSelect = (id: string) => {
    settings.update({ theme: id });
  };

  const handleInstall = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !vaultPath) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as CustomTheme;
        if (!parsed.id || !parsed.name || !parsed.colors) {
          addToast(ts('appearance.theme.invalidThemeFile'), 'error');
          return;
        }
        const requiredKeys: (keyof FlavorColors)[] = [
          'rosewater','flamingo','pink','mauve','red','maroon','peach','yellow',
          'green','teal','sky','sapphire','blue','lavender','text','subtext1',
          'subtext0','overlay2','overlay1','overlay0','surface2','surface1',
          'surface0','base','mantle','crust',
        ];
        const missing = requiredKeys.filter((k) => !parsed.colors[k]);
        if (missing.length > 0) {
          addToast(ts('appearance.theme.missingColors', { colors: missing.join(', ') }), 'error');
          return;
        }
        await saveCustomTheme(vaultPath, parsed.id, text);
        registerCustomTheme(parsed);
        loadCustomThemes();
        settings.update({ theme: parsed.id });
      } catch {
        addToast(ts('appearance.theme.parseError'), 'error');
      }
    };
    input.click();
  };

  const handleDelete = async (id: string) => {
    if (!vaultPath) return;
    await deleteCustomTheme(vaultPath, id);
    unregisterCustomTheme(id);
    if (settings.theme === id) {
      settings.update({ theme: 'mocha' });
    }
    loadCustomThemes();
  };

  return (
    <div className="flex flex-col gap-3">
      {THEME_GROUPS.map((group) => (
        <div key={group.labelKey}>
          <div
            className="text-[0.6rem] font-semibold uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--ctp-overlay1)' }}
          >
            {ts(group.labelKey)}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {group.ids.map((id) => (
              <ThemeCard
                key={id}
                themeId={id}
                label={flavorLabels[id]}
                colors={flavors[id]}
                isSelected={settings.theme === id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      ))}

      {customThemesList.length > 0 && (
        <div>
          <div
            className="text-[0.6rem] font-semibold uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--ctp-overlay1)' }}
          >
            {ts('appearance.theme.custom')}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {customThemesList.map((t) => (
              <ThemeCard
                key={t.id}
                themeId={t.id}
                label={t.name}
                colors={t.colors}
                isSelected={settings.theme === t.id}
                isCustom
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      <button
        className="text-xs px-3 py-1.5 rounded transition-colors self-start"
        style={{
          backgroundColor: 'var(--ctp-surface0)',
          color: 'var(--ctp-accent)',
          border: '1px solid var(--ctp-surface2)',
        }}
        onClick={handleInstall}
      >
        {ts('appearance.theme.installTheme')}
      </button>
    </div>
  );
}
