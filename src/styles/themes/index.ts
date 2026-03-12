export type { FlavorColors, ThemeDefinition, CustomTheme } from './types';

import type { FlavorColors, CustomTheme } from './types';
import { catppuccinThemes } from './catppuccin';
import { nordThemes } from './nord';
import { draculaThemes } from './dracula';
import { gruvboxThemes } from './gruvbox';
import { tokyoNightThemes } from './tokyo-night';
import { oneDarkThemes } from './one-dark';
import { solarizedThemes } from './solarized';
import { rosePineThemes } from './rose-pine';
import { githubThemes } from './github';
import { monokaiThemes } from './monokai';
import { materialThemes } from './material';
import { nightOwlThemes } from './night-owl';
import { ayuThemes } from './ayu';
import { kanagawaThemes } from './kanagawa';
import { everforestThemes } from './everforest';

// --- All built-in themes ---

const allThemes = [
  ...catppuccinThemes,
  ...nordThemes,
  ...draculaThemes,
  ...gruvboxThemes,
  ...tokyoNightThemes,
  ...oneDarkThemes,
  ...solarizedThemes,
  ...rosePineThemes,
  ...githubThemes,
  ...monokaiThemes,
  ...materialThemes,
  ...nightOwlThemes,
  ...ayuThemes,
  ...kanagawaThemes,
  ...everforestThemes,
];

// --- Derived lookup maps ---

export const flavors: Record<string, FlavorColors> = {};
export const flavorLabels: Record<string, string> = {};
const darkThemes = new Set<string>();

for (const theme of allThemes) {
  flavors[theme.id] = theme.colors;
  flavorLabels[theme.id] = theme.label;
  if (theme.dark) darkThemes.add(theme.id);
}

// --- Theme groups for the card grid ---

export type CatppuccinFlavor = 'mocha' | 'macchiato' | 'frappe' | 'latte';

export type BuiltinThemeId = typeof allThemes[number]['id'];

export const THEME_GROUPS = [
  {
    labelKey: 'appearance.theme.catppuccin',
    ids: catppuccinThemes.map((t) => t.id),
  },
  {
    labelKey: 'appearance.theme.dark',
    ids: allThemes.filter((t) => t.dark && !catppuccinThemes.includes(t)).map((t) => t.id),
  },
  {
    labelKey: 'appearance.theme.light',
    ids: allThemes.filter((t) => !t.dark && !catppuccinThemes.includes(t)).map((t) => t.id),
  },
];

// --- Custom theme registry ---

const customThemes = new Map<string, CustomTheme>();

export function registerCustomTheme(theme: CustomTheme) {
  customThemes.set(theme.id, theme);
}

export function unregisterCustomTheme(id: string) {
  customThemes.delete(id);
}

export function getCustomThemes(): CustomTheme[] {
  return Array.from(customThemes.values());
}

export function getCustomTheme(id: string): CustomTheme | undefined {
  return customThemes.get(id);
}

// --- Theme queries ---

export function isBuiltinFlavor(theme: string): boolean {
  return theme in flavors;
}

export function isDarkTheme(theme: string): boolean {
  if (darkThemes.has(theme)) return true;
  if (isBuiltinFlavor(theme)) return false;
  const custom = customThemes.get(theme);
  return custom ? custom.dark : true;
}

export function isDarkFlavor(flavor: CatppuccinFlavor): boolean {
  return flavor !== 'latte';
}

// --- Theme application ---

function applyColors(colors: FlavorColors) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    const cssKey = key.replace(/([A-Z])/g, (_, c: string) => c.toLowerCase());
    root.style.setProperty(`--ctp-${cssKey}`, value);
  }
}

export function applyFlavor(flavor: CatppuccinFlavor) {
  applyColors(flavors[flavor]);
}

export function applyTheme(theme: string) {
  if (isBuiltinFlavor(theme)) {
    applyColors(flavors[theme]);
  } else {
    const custom = customThemes.get(theme);
    if (custom) {
      applyColors(custom.colors);
    }
  }
}
