import { create } from 'zustand';
import type { FlavorColors, CustomTheme } from '../styles/themes/types';
import {
  flavors,
  isBuiltinFlavor,
  getCustomTheme,
  registerCustomTheme,
  applyTheme,
} from '../styles/catppuccin-flavors';
import { useSettingsStore } from './settings-store';
import { useVaultStore } from './vault-store';
import { saveCustomTheme } from '../lib/tauri-commands';

export type ThemeStudioCategory = 'all' | 'surfaces' | 'text' | 'accents' | 'semantic' | 'editor';

export interface ThemeStudioState {
  isOpen: boolean;
  originalColors: FlavorColors | null;
  currentColors: FlavorColors | null;
  semanticColors: Record<string, string>;
  originalSemanticColors: Record<string, string>;
  activeCategory: ThemeStudioCategory;
  hasChanges: boolean;

  open: () => void;
  close: () => void;
  setCategory: (cat: ThemeStudioCategory) => void;
  setColor: (key: string, value: string) => void;
  discardChanges: () => void;
  saveAs: (name: string) => Promise<void>;
}

function getColorsForTheme(themeId: string): FlavorColors | null {
  if (isBuiltinFlavor(themeId)) {
    return flavors[themeId] ?? null;
  }
  const custom = getCustomTheme(themeId);
  return custom ? custom.colors : null;
}

function applyColorsToDocument(colors: FlavorColors) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--ctp-${key}`, value as string);
  }
}

const SEMANTIC_KEYS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'link', 'bold', 'italic', 'code', 'tag-color', 'blockquote', 'list-marker'];

/** Maps semantic keys to the palette key they default to in theme.css */
const SEMANTIC_DEFAULTS: Record<string, keyof FlavorColors> = {
  h1: 'red',
  h2: 'peach',
  h3: 'yellow',
  h4: 'green',
  h5: 'blue',
  h6: 'mauve',
  link: 'blue',
  bold: 'peach',
  italic: 'pink',
  code: 'green',
  'tag-color': 'blue',
  blockquote: 'overlay2',
  'list-marker': 'yellow',
};

/** Resolve semantic colors from the current palette */
function readSemanticColors(palette: FlavorColors): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of SEMANTIC_KEYS) {
    const paletteKey = SEMANTIC_DEFAULTS[key];
    result[key] = paletteKey ? palette[paletteKey] : '#000000';
  }
  return result;
}

function removeSemanticOverrides(keys: string[]) {
  const root = document.documentElement;
  for (const key of keys) {
    root.style.removeProperty(`--ctp-${key}`);
  }
}

export const useThemeStudioStore = create<ThemeStudioState>((set, get) => ({
  isOpen: false,
  originalColors: null,
  currentColors: null,
  semanticColors: {},
  originalSemanticColors: {},
  activeCategory: 'surfaces',
  hasChanges: false,

  open: () => {
    const themeId = useSettingsStore.getState().theme;
    const colors = getColorsForTheme(themeId);
    const palette = colors ?? (flavors.mocha as FlavorColors);
    const semanticColors = readSemanticColors(palette);
    set({
      isOpen: true,
      originalColors: colors ? { ...colors } : null,
      currentColors: colors ? { ...colors } : null,
      semanticColors: { ...semanticColors },
      originalSemanticColors: { ...semanticColors },
      hasChanges: false,
    });
  },

  close: () => {
    const { hasChanges, originalColors, originalSemanticColors } = get();
    if (hasChanges) {
      if (originalColors) {
        applyColorsToDocument(originalColors);
      }
      removeSemanticOverrides(Object.keys(originalSemanticColors));
    }
    set({
      isOpen: false,
      hasChanges: false,
      originalColors: null,
      currentColors: null,
      semanticColors: {},
      originalSemanticColors: {},
    });
  },

  setCategory: (cat) => {
    set({ activeCategory: cat });
  },

  setColor: (key, value) => {
    const { currentColors, semanticColors } = get();
    document.documentElement.style.setProperty(`--ctp-${key}`, value);
    if (SEMANTIC_KEYS.includes(key)) {
      set({ semanticColors: { ...semanticColors, [key]: value }, hasChanges: true });
    } else {
      if (!currentColors) return;
      const updated: FlavorColors = { ...currentColors, [key as keyof FlavorColors]: value };
      set({ currentColors: updated, hasChanges: true });
    }
  },

  discardChanges: () => {
    const { originalColors, originalSemanticColors } = get();
    if (originalColors) {
      applyColorsToDocument(originalColors);
    }
    removeSemanticOverrides(Object.keys(originalSemanticColors));
    set({
      currentColors: originalColors ? { ...originalColors } : null,
      semanticColors: { ...originalSemanticColors },
      hasChanges: false,
    });
  },

  saveAs: async (name: string) => {
    const { currentColors, semanticColors } = get();
    if (!currentColors) return;

    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) throw new Error('No vault open');

    const id = `custom-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const theme: CustomTheme = {
      id,
      name,
      dark: true,
      colors: { ...currentColors },
    };

    const themeWithSemantic = { ...theme, semanticColors: { ...semanticColors } };
    const filename = `${id}.json`;
    await saveCustomTheme(vaultPath, filename, JSON.stringify(themeWithSemantic, null, 2));
    registerCustomTheme(theme);
    useSettingsStore.getState().update({ theme: id });
    applyTheme(id);

    set({
      isOpen: false,
      hasChanges: false,
      originalColors: null,
      currentColors: null,
      semanticColors: {},
      originalSemanticColors: {},
    });
  },
}));
