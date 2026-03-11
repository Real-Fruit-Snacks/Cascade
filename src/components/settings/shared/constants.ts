import i18n from '../../../i18n';
import { Settings as SettingsIcon, Type, Palette, FolderOpen, Sliders, ToggleRight, Puzzle, Keyboard, Save, ArrowLeftRight, Star, LayoutGrid, ChevronsDownUp, Calendar, Maximize2, Paintbrush, Network, Highlighter, Image, Columns, Eye, MonitorPlay, List, FileJson2, Database, Search, SpellCheck, Cloud, PanelBottom, ListTree, Hash, FileStack, AlignCenter, Target, Link, Command } from 'lucide-react';
import { VariablesIcon } from '../../icons/VariablesIcon';
import type { Settings } from '../../../stores/settings-store';

export const FONT_OPTIONS = [
  '"JetBrains Mono", ui-monospace, monospace',
  '"Fira Code", ui-monospace, monospace',
  '"Cascadia Code", ui-monospace, monospace',
  '"Source Code Pro", ui-monospace, monospace',
  'ui-monospace, monospace',
];

export function fontLabel(family: string): string {
  const match = family.match(/^"([^"]+)"/);
  if (match) return match[1];
  return family.startsWith('ui-') ? i18n.t('settings:systemMonospace') : family;
}

export const DEFAULT_SHORTCUTS: Record<string, string> = {
  'file.new': 'Ctrl+N',
  'file.save': 'Ctrl+S',
  'file.quick-open': 'Ctrl+O',
  'tab.close': 'Ctrl+W',
  'tab.next': 'Ctrl+Tab',
  'tab.prev': 'Ctrl+Shift+Tab',
  'view.command-palette': 'Ctrl+P',
  'view.toggle-sidebar': 'Ctrl+B',
  'edit.find': 'Ctrl+F',
  'edit.find-replace': 'Ctrl+H',
  'view.search': 'Ctrl+Shift+F',
  'view.search-replace': 'Ctrl+Shift+H',
  'file.batchExport': 'Ctrl+Shift+B',
  'sidebar.files': 'Ctrl+Shift+E',
  'sidebar.tags': 'Ctrl+Shift+T',
  'sidebar.backlinks': 'Ctrl+Shift+L',
  'sidebar.outline': 'Ctrl+Shift+O',
  'sidebar.bookmarks': 'Ctrl+Shift+K',
  'app.settings': 'Ctrl+,',
  'daily.open-today': 'Alt+D',
};

/** Display a shortcut string with spaces around '+' for readability */
export function formatShortcutDisplay(shortcut: string): string {
  return shortcut.split('+').join(' + ');
}

export const SHORTCUT_GROUPS: { labelKey: string; ids: string[] }[] = [
  { labelKey: 'shortcuts.groups.files', ids: ['file.new', 'file.save', 'file.quick-open'] },
  { labelKey: 'shortcuts.groups.tabs', ids: ['tab.close', 'tab.next', 'tab.prev'] },
  { labelKey: 'shortcuts.groups.navigation', ids: ['view.command-palette', 'edit.find', 'edit.find-replace', 'view.search', 'view.search-replace'] },
  { labelKey: 'shortcuts.groups.export', ids: ['file.batchExport'] },
  { labelKey: 'shortcuts.groups.sidebar', ids: ['view.toggle-sidebar', 'sidebar.files', 'sidebar.tags', 'sidebar.backlinks', 'sidebar.outline', 'sidebar.bookmarks'] },
  { labelKey: 'shortcuts.groups.app', ids: ['app.settings', 'daily.open-today'] },
];

export function formatKeyCombo(e: KeyboardEvent): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join('+');
}

export type SettingsCategory = 'editor' | 'appearance' | 'files' | 'folder-colors' | 'general' | 'sync-options' | 'features' | 'shortcuts' | 'plugins' | 'wikilinks-options' | 'livepreview-options' | 'tags-options' | 'graph-options' | 'backlinks-options' | 'outline-options' | 'variables-options' | 'dailynotes-options' | 'codefolding-options' | 'highlight-options' | 'properties-options' | 'statusbar-options' | 'autosave-options' | 'spellcheck-options' | 'templates-options' | 'search-options' | 'slashcommands-options' | 'focusmode-options' | 'wordcountgoal-options' | 'bookmarks-options' | 'typewriter-options' | 'indentguides-options' | 'imagepreview-options' | 'toc-options' | 'query-options' | 'mediaviewer-options' | 'canvas-options';

export const CATEGORIES: { id: SettingsCategory; labelKey: string; icon: typeof SettingsIcon }[] = [
  { id: 'editor', labelKey: 'categories.editor', icon: Type },
  { id: 'appearance', labelKey: 'categories.appearance', icon: Palette },
  { id: 'files', labelKey: 'categories.files', icon: FolderOpen },
  { id: 'general', labelKey: 'categories.general', icon: Sliders },
  { id: 'features', labelKey: 'categories.features', icon: ToggleRight },
  { id: 'plugins', labelKey: 'categories.plugins', icon: Puzzle },
  { id: 'shortcuts', labelKey: 'categories.shortcuts', icon: Keyboard },
];

/** Feature option pages — shown in sidebar only when the feature is enabled. */
export const FEATURE_OPTION_PAGES: { id: SettingsCategory; labelKey: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; settingsKey: keyof Settings }[] = [
  { id: 'autosave-options', labelKey: 'featurePages.autosave', icon: Save, settingsKey: 'autoSaveEnabled' },
  { id: 'backlinks-options', labelKey: 'featurePages.backlinks', icon: ArrowLeftRight, settingsKey: 'enableBacklinks' },
  { id: 'bookmarks-options', labelKey: 'featurePages.bookmarks', icon: Star, settingsKey: 'enableBookmarks' },
  { id: 'canvas-options', labelKey: 'featurePages.canvas', icon: LayoutGrid, settingsKey: 'enableCanvas' },
  { id: 'codefolding-options', labelKey: 'featurePages.codeFolding', icon: ChevronsDownUp, settingsKey: 'enableCodeFolding' },
  { id: 'dailynotes-options', labelKey: 'featurePages.dailyNotes', icon: Calendar, settingsKey: 'enableDailyNotes' },
  { id: 'focusmode-options', labelKey: 'featurePages.focusMode', icon: Maximize2, settingsKey: 'enableFocusMode' },
  { id: 'folder-colors', labelKey: 'featurePages.folderColors', icon: Paintbrush, settingsKey: 'enableFolderColors' },
  { id: 'graph-options', labelKey: 'featurePages.graphView', icon: Network, settingsKey: 'enableGraphView' },
  { id: 'highlight-options', labelKey: 'featurePages.highlights', icon: Highlighter, settingsKey: 'enableHighlightSyntax' },
  { id: 'imagepreview-options', labelKey: 'featurePages.imagePreview', icon: Image, settingsKey: 'enableImagePreview' },
  { id: 'indentguides-options', labelKey: 'featurePages.indentGuides', icon: Columns, settingsKey: 'enableIndentGuides' },
  { id: 'livepreview-options', labelKey: 'featurePages.livePreview', icon: Eye, settingsKey: 'enableLivePreview' },
  { id: 'mediaviewer-options', labelKey: 'featurePages.mediaViewer', icon: MonitorPlay, settingsKey: 'enableMediaViewer' },
  { id: 'outline-options', labelKey: 'featurePages.outline', icon: List, settingsKey: 'enableOutline' },
  { id: 'properties-options', labelKey: 'featurePages.properties', icon: FileJson2, settingsKey: 'enableProperties' },
  { id: 'query-options', labelKey: 'featurePages.queryPreview', icon: Database, settingsKey: 'enableQueryPreview' },
  { id: 'search-options', labelKey: 'featurePages.search', icon: Search, settingsKey: 'enableSearch' },
  { id: 'slashcommands-options' as SettingsCategory, labelKey: 'featurePages.slashCommands', icon: Command, settingsKey: 'enableSlashCommands' },
  { id: 'spellcheck-options', labelKey: 'featurePages.spellcheck', icon: SpellCheck, settingsKey: 'spellcheck' },
  { id: 'sync-options', labelKey: 'featurePages.sync', icon: Cloud, settingsKey: 'syncEnabled' },
  { id: 'statusbar-options', labelKey: 'featurePages.statusBar', icon: PanelBottom, settingsKey: 'enableStatusBar' },
  { id: 'toc-options', labelKey: 'featurePages.tableOfContents', icon: ListTree, settingsKey: 'enableTableOfContents' },
  { id: 'tags-options', labelKey: 'featurePages.tags', icon: Hash, settingsKey: 'enableTags' },
  { id: 'templates-options', labelKey: 'featurePages.templates', icon: FileStack, settingsKey: 'enableTemplates' },
  { id: 'typewriter-options', labelKey: 'featurePages.typewriterMode', icon: AlignCenter, settingsKey: 'enableTypewriterMode' },
  { id: 'variables-options', labelKey: 'featurePages.variables', icon: VariablesIcon, settingsKey: 'enableVariables' },
  { id: 'wikilinks-options', labelKey: 'featurePages.wikiLinks', icon: Link, settingsKey: 'enableWikiLinks' },
  { id: 'wordcountgoal-options', labelKey: 'featurePages.wordCountGoal', icon: Target, settingsKey: 'enableWordCountGoal' },
];
