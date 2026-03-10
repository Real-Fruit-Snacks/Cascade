import { create } from 'zustand';
import type { ViewMode } from '../types/index';
import { readVaultSettings, writeVaultSettings } from '../lib/tauri-commands';

export type FileSortOrder = 'name-asc' | 'name-desc' | 'modified-newest' | 'modified-oldest';
export type StartupBehavior = 'reopen-last' | 'show-picker';
export type AttachmentLocation = 'vault-folder' | 'same-folder';
export type AccentColor = 'mauve' | 'blue' | 'pink' | 'red' | 'peach' | 'yellow' | 'green' | 'teal' | 'sky' | 'lavender' | 'flamingo' | 'rosewater';
export type FolderColorStyle = 'icon-only' | 'text' | 'background' | 'accent-bar' | 'full' | 'dot' | 'custom';
export type IndentGuideStyle = 'solid' | 'dashed' | 'dotted';
export type AutoSaveMode = 'timer' | 'focus-change';

export interface Settings {
  // Editor
  fontSize: number;
  fontFamily: string;
  showLineNumbers: boolean;
  lineWrapping: boolean;
  theme: string;
  vimMode: boolean;
  tabSize: number;
  highlightActiveLine: boolean;
  readableLineLength: number;
  defaultViewMode: ViewMode;
  spellcheck: boolean;
  spellcheckSkipCapitalized: boolean;
  codeBlockLineNumbers: boolean;
  // Appearance
  accentColor: AccentColor;
  sidebarPosition: 'left' | 'right';
  uiFontSize: number;
  // Files
  fileSortOrder: FileSortOrder;
  confirmBeforeDelete: boolean;
  useTrash: boolean;
  showFileExtensions: boolean;
  showFolderIcons: boolean;
  showFileIcons: boolean;
  folderColorSubfolders: boolean;
  folderColorFiles: boolean;
  // Folder color targets (what parts of a folder row get colored)
  folderColorIcon: boolean;
  folderColorName: boolean;
  folderColorBackground: boolean;
  folderColorChevron: boolean;
  // File color targets (what parts of a file row get colored when inheriting)
  folderColorFileIcon: boolean;
  folderColorFileName: boolean;
  folderColorFileBackground: boolean;
  // Folder color style presets
  folderColorStyle: FolderColorStyle;
  folderColorFileStyle: FolderColorStyle;
  folderColorBold: boolean;
  folderColorOpacity: number;
  attachmentLocation: AttachmentLocation;
  attachmentsFolder: string;
  templatesFolder: string;
  // General
  autoSaveEnabled: boolean;
  autoSaveMode: AutoSaveMode;
  autoSaveInterval: number;
  startupBehavior: StartupBehavior;
  language: string;
  customKeybindings: Record<string, string>;
  // Features (toggleable)
  showWelcomeView: boolean;
  enableFolderColors: boolean;
  enableWikiLinks: boolean;
  enableLivePreview: boolean;
  enableTags: boolean;
  enableGraphView: boolean;
  enableBacklinks: boolean;
  enableOutline: boolean;
  enabledPlugins: string[];
  pluginsEnabled: boolean;
  // Wiki Links options
  wikiLinksOpenInNewTab: boolean;
  wikiLinksShowFullPath: boolean;
  wikiLinksCreateOnFollow: boolean;
  // Live Preview options
  livePreviewHeadings: boolean;
  livePreviewBold: boolean;
  livePreviewItalic: boolean;
  livePreviewLinks: boolean;
  livePreviewImages: boolean;
  livePreviewCodeBlocks: boolean;
  // Tags options
  tagsAutoComplete: boolean;
  tagsNestedSupport: boolean;
  // Graph View options
  graphNodeSize: number;
  graphLinkDistance: number;
  graphShowOrphans: boolean;
  graphMaxNodes: number;
  // Backlinks options
  backlinksContextLines: number;
  backlinksGroupByFolder: boolean;
  // Outline options
  outlineMinLevel: number;
  outlineAutoExpand: boolean;
  // Variables (dynamic variable replacement)
  enableVariables: boolean;
  variablesHighlight: boolean;
  variablesOpenDelimiter: string;
  variablesCloseDelimiter: string;
  variablesDefaultSeparator: string;
  variablesMissingText: string;
  variablesSupportNesting: boolean;
  variablesCaseInsensitive: boolean;
  variablesArrayJoinSeparator: string;
  variablesPreserveOnMissing: boolean;
  variablesSidebarAction: 'list' | 'menu';
  // Daily Notes
  enableDailyNotes: boolean;
  dailyNotesFolder: string;
  dailyNotesFormat: string;
  dailyNotesTemplate: string;
  // Weekly Notes
  weeklyNotesFolder: string;
  weeklyNotesFormat: string;
  weeklyNotesTemplate: string;
  // Monthly Notes
  monthlyNotesFolder: string;
  monthlyNotesFormat: string;
  monthlyNotesTemplate: string;
  // Quarterly Notes
  quarterlyNotesFolder: string;
  quarterlyNotesFormat: string;
  quarterlyNotesTemplate: string;
  // Yearly Notes
  yearlyNotesFolder: string;
  yearlyNotesFormat: string;
  yearlyNotesTemplate: string;
  // Code Folding
  enableCodeFolding: boolean;
  foldHeadings: boolean;
  foldCodeBlocks: boolean;
  foldMinLevel: number;
  // Highlight Syntax (==highlight==)
  enableHighlightSyntax: boolean;
  highlightColor: AccentColor;
  // Properties Widget
  enableProperties: boolean;
  propertiesShowTypes: boolean;
  // Status Bar
  enableStatusBar: boolean;
  statusBarWords: boolean;
  statusBarChars: boolean;
  statusBarReadingTime: boolean;
  statusBarSelection: boolean;
  // Templates
  enableTemplates: boolean;
  // Search
  enableSearch: boolean;
  searchCaseSensitive: boolean;
  searchRegex: boolean;
  searchWholeWord: boolean;
  // Focus Mode
  enableFocusMode: boolean;
  focusModeDimParagraphs: boolean;
  focusModeTypewriter: boolean;
  // Word Count Goal
  enableWordCountGoal: boolean;
  wordCountGoalTarget: number;
  wordCountGoalShowStatusBar: boolean;
  wordCountGoalNotify: boolean;
  // Bookmarks
  enableBookmarks: boolean;
  bookmarkedFiles: string[];
  // Typewriter Mode
  enableTypewriterMode: boolean;
  typewriterOffset: number;
  // Indent Guides
  enableIndentGuides: boolean;
  indentGuideColor: AccentColor;
  indentGuideStyle: IndentGuideStyle;
  // Image Preview
  enableImagePreview: boolean;
  imagePreviewMaxHeight: number;
  // Math Preview
  enableMathPreview: boolean;
  // Callout Preview
  enableCalloutPreview: boolean;
  // Mermaid Preview
  enableMermaidPreview: boolean;
  // Query Preview (dataview-like)
  enableQueryPreview: boolean;
  // Embed Preview (![[note]])
  enableEmbedPreview: boolean;
  // Table of Contents
  enableTableOfContents: boolean;
  tocAutoUpdate: boolean;
  // Canvas
  enableCanvas: boolean;
  // Media Viewer
  enableMediaViewer: boolean;
  pdfDefaultZoom: number;
  imageDefaultZoom: 'fit' | 'actual';
  // Plugin/Theme Registries
  pluginRegistries: string[];
  themeRegistries: string[];
}

export const DEFAULTS: Settings = {
  fontSize: 14,
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  showLineNumbers: false,
  lineWrapping: true,
  theme: 'mocha',
  vimMode: false,
  tabSize: 4,
  highlightActiveLine: true,
  readableLineLength: 0,
  defaultViewMode: 'live',
  spellcheck: true,
  spellcheckSkipCapitalized: true,
  codeBlockLineNumbers: false,
  accentColor: 'mauve',
  sidebarPosition: 'left',
  uiFontSize: 14,
  fileSortOrder: 'name-asc',
  confirmBeforeDelete: true,
  useTrash: true,
  showFileExtensions: false,
  showFolderIcons: true,
  showFileIcons: true,
  folderColorSubfolders: true,
  folderColorFiles: false,
  folderColorIcon: true,
  folderColorName: false,
  folderColorBackground: false,
  folderColorChevron: false,
  folderColorFileIcon: true,
  folderColorFileName: false,
  folderColorFileBackground: false,
  folderColorStyle: 'icon-only',
  folderColorFileStyle: 'icon-only',
  folderColorBold: false,
  folderColorOpacity: 0.15,
  attachmentLocation: 'vault-folder',
  attachmentsFolder: 'attachments',
  templatesFolder: 'templates',
  autoSaveEnabled: true,
  autoSaveMode: 'focus-change',
  autoSaveInterval: 1000,
  startupBehavior: 'reopen-last',
  language: 'en',
  customKeybindings: {},
  showWelcomeView: true,
  enableFolderColors: false,
  enableWikiLinks: true,
  enableLivePreview: true,
  enableTags: true,
  enableGraphView: false,
  enableBacklinks: true,
  enableOutline: false,
  enabledPlugins: [],
  pluginsEnabled: false,
  wikiLinksOpenInNewTab: false,
  wikiLinksShowFullPath: false,
  wikiLinksCreateOnFollow: true,
  livePreviewHeadings: true,
  livePreviewBold: true,
  livePreviewItalic: true,
  livePreviewLinks: true,
  livePreviewImages: true,
  livePreviewCodeBlocks: true,
  tagsAutoComplete: true,
  tagsNestedSupport: true,
  graphNodeSize: 6,
  graphLinkDistance: 80,
  graphShowOrphans: true,
  graphMaxNodes: 500,
  backlinksContextLines: 2,
  backlinksGroupByFolder: false,
  outlineMinLevel: 1,
  outlineAutoExpand: true,
  enableVariables: false,
  variablesHighlight: true,
  variablesOpenDelimiter: '<',
  variablesCloseDelimiter: '>',
  variablesDefaultSeparator: ':',
  variablesMissingText: '[MISSING]',
  variablesSupportNesting: true,
  variablesCaseInsensitive: false,
  variablesArrayJoinSeparator: ', ',
  variablesPreserveOnMissing: false,
  variablesSidebarAction: 'menu',
  enableDailyNotes: false,
  dailyNotesFolder: 'daily',
  dailyNotesFormat: 'YYYY-MM-DD',
  dailyNotesTemplate: '',
  weeklyNotesFolder: 'weekly',
  weeklyNotesFormat: 'YYYY-[W]WW',
  weeklyNotesTemplate: '',
  monthlyNotesFolder: 'monthly',
  monthlyNotesFormat: 'YYYY-MM',
  monthlyNotesTemplate: '',
  quarterlyNotesFolder: 'quarterly',
  quarterlyNotesFormat: 'YYYY-[Q]Q',
  quarterlyNotesTemplate: '',
  yearlyNotesFolder: 'yearly',
  yearlyNotesFormat: 'YYYY',
  yearlyNotesTemplate: '',
  enableCodeFolding: false,
  foldHeadings: true,
  foldCodeBlocks: true,
  foldMinLevel: 1,
  enableHighlightSyntax: false,
  highlightColor: 'yellow',
  enableProperties: true,
  propertiesShowTypes: true,
  enableStatusBar: true,
  statusBarWords: true,
  statusBarChars: true,
  statusBarReadingTime: true,
  statusBarSelection: true,
  enableTemplates: false,
  enableSearch: true,
  searchCaseSensitive: false,
  searchRegex: false,
  searchWholeWord: false,
  enableFocusMode: false,
  focusModeDimParagraphs: true,
  focusModeTypewriter: false,
  enableWordCountGoal: false,
  wordCountGoalTarget: 1000,
  wordCountGoalShowStatusBar: true,
  wordCountGoalNotify: true,
  enableBookmarks: true,
  bookmarkedFiles: [],
  enableTypewriterMode: false,
  typewriterOffset: 50,
  enableIndentGuides: false,
  indentGuideColor: 'lavender',
  indentGuideStyle: 'solid',
  enableImagePreview: true,
  imagePreviewMaxHeight: 300,
  enableMathPreview: false,
  enableCalloutPreview: true,
  enableMermaidPreview: false,
  enableCanvas: true,
  enableQueryPreview: false,
  enableEmbedPreview: true,
  enableTableOfContents: false,
  tocAutoUpdate: false,
  enableMediaViewer: false,
  pdfDefaultZoom: 100,
  imageDefaultZoom: 'fit' as const,
  pluginRegistries: [],
  themeRegistries: [],
};

// Current vault path for saving settings — set by loadFromVault
let currentVaultPath: string | null = null;

// App-level settings that must be readable before any vault opens
const APP_LEVEL_KEYS: (keyof Settings)[] = ['startupBehavior'];
const APP_SETTINGS_KEY = 'cascade-app-settings';

function saveAppLevelSettings(settings: Partial<Settings>) {
  const stored: Record<string, unknown> = {};
  for (const key of APP_LEVEL_KEYS) {
    if (key in settings) {
      stored[key] = settings[key as keyof Settings];
    }
  }
  if (Object.keys(stored).length > 0) {
    try {
      const existing = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || '{}');
      localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify({ ...existing, ...stored }));
    } catch { /* ignore */ }
  }
}

export function getAppLevelSettings(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const safe: Partial<Settings> = {};
    for (const key of APP_LEVEL_KEYS) {
      if (key in parsed && typeof parsed[key] === typeof DEFAULTS[key]) {
        (safe as Record<string, unknown>)[key] = parsed[key];
      }
    }
    return safe;
  } catch {
    return {};
  }
}

function saveSettingsToVault(settings: Settings) {
  saveAppLevelSettings(settings);
  if (!currentVaultPath) return;
  writeVaultSettings(currentVaultPath, JSON.stringify(settings, null, 2)).catch((e) => {
    import('../stores/toast-store').then(({ useToastStore }) => {
      useToastStore.getState().addToast(`Failed to save settings: ${e instanceof Error ? e.message : String(e)}`, 'error');
    });
  });
}

interface SettingsActions {
  update: (partial: Partial<Settings>) => void;
  reset: () => void;
  getShortcut: (commandId: string, defaultShortcut: string) => string;
  loadFromVault: (vaultPath: string) => Promise<void>;
}

export const useSettingsStore = create<Settings & SettingsActions>((set, get) => ({
  ...DEFAULTS,

  update: (partial) => {
    set((s) => {
      const next = { ...s, ...partial };
      // Extract only Settings fields for persistence (not store actions)
      const data = {} as Settings;
      for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic key copy from typed source
        (data as Record<string, any>)[key] = (next as Record<string, any>)[key];
      }
      saveSettingsToVault(data);
      return next;
    });
    if (partial.language) {
      import('../i18n').then(({ default: i18n }) => {
        i18n.changeLanguage(partial.language as string);
      });
    }
  },

  reset: () => {
    saveSettingsToVault(DEFAULTS);
    set(DEFAULTS);
  },

  getShortcut: (commandId: string, defaultShortcut: string): string => {
    const custom = get().customKeybindings[commandId];
    return custom !== undefined ? custom : defaultShortcut;
  },

  loadFromVault: async (vaultPath: string) => {
    currentVaultPath = vaultPath;
    try {
      const raw = await readVaultSettings(vaultPath);
      const parsed = JSON.parse(raw);
      // Only pick known settings keys with matching types to prevent injection
      const safe: Partial<Settings> = {};
      for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
        if (key in parsed && typeof parsed[key] === typeof DEFAULTS[key]) {
          if (Array.isArray(DEFAULTS[key]) && !Array.isArray(parsed[key])) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic key assignment from validated source
          (safe as Record<string, any>)[key] = parsed[key];
        }
      }
      set({ ...DEFAULTS, ...safe });
    } catch {
      set({ ...DEFAULTS });
    }
  },
}));

// Expose store for e2e testing
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__ZUSTAND_SETTINGS_STORE__ = useSettingsStore;
}
