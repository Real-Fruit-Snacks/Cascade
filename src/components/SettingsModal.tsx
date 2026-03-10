import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Keyboard, RotateCcw, Search, Settings as SettingsIcon, Type, Sliders, X, Palette, FolderOpen, ToggleRight, Puzzle, Link, Eye, Hash, Network, ArrowLeftRight, List, Paintbrush, Calendar, ChevronsDownUp, Highlighter, FileJson2, PanelBottom, Save, SpellCheck, FileStack, Maximize2, Target, Star, AlignCenter, Columns, Image, ListTree, Database, MonitorPlay, LayoutGrid, Cloud } from 'lucide-react';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { VariablesIcon } from './icons/VariablesIcon';
import { useSettingsStore, DEFAULTS, type Settings, type FileSortOrder, type StartupBehavior, type AccentColor, type AttachmentLocation, type FolderColorStyle, type IndentGuideStyle } from '../stores/settings-store';
import { usePluginStore, type PluginEntry } from '../stores/plugin-store';
import { useVaultStore } from '../stores/vault-store';
import { commandRegistry } from '../lib/command-registry';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { flavorLabels, registerCustomTheme, unregisterCustomTheme, type CustomTheme, type FlavorColors } from '../styles/catppuccin-flavors';
import { listCustomThemes, saveCustomTheme, deleteCustomTheme, readCustomDictionary, writeCustomDictionary, gitTestConnection, gitInitRepo, gitStatus as gitStatusCmd, gitDisconnect, storeSyncPat, readSyncPat, deleteSyncPat } from '../lib/tauri-commands';
import { useSyncStore } from '../stores/sync-store';
import type { ViewMode } from '../types/index';
import { FeatureWiki } from './FeatureWiki';
import { reloadCustomDictionary } from '../editor/spellcheck-engine';

const FONT_OPTIONS = [
  '"JetBrains Mono", ui-monospace, monospace',
  '"Fira Code", ui-monospace, monospace',
  '"Cascadia Code", ui-monospace, monospace',
  '"Source Code Pro", ui-monospace, monospace',
  'ui-monospace, monospace',
];

function fontLabel(family: string): string {
  const match = family.match(/^"([^"]+)"/);
  if (match) return match[1];
  return family.startsWith('ui-') ? i18n.t('settings:systemMonospace') : family;
}


const DEFAULT_SHORTCUTS: Record<string, string> = {
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
function formatShortcutDisplay(shortcut: string): string {
  return shortcut.split('+').join(' + ');
}

const SHORTCUT_GROUPS: { labelKey: string; ids: string[] }[] = [
  { labelKey: 'shortcuts.groups.files', ids: ['file.new', 'file.save', 'file.quick-open'] },
  { labelKey: 'shortcuts.groups.tabs', ids: ['tab.close', 'tab.next', 'tab.prev'] },
  { labelKey: 'shortcuts.groups.navigation', ids: ['view.command-palette', 'edit.find', 'edit.find-replace', 'view.search', 'view.search-replace'] },
  { labelKey: 'shortcuts.groups.export', ids: ['file.batchExport'] },
  { labelKey: 'shortcuts.groups.sidebar', ids: ['view.toggle-sidebar', 'sidebar.files', 'sidebar.tags', 'sidebar.backlinks', 'sidebar.outline', 'sidebar.bookmarks'] },
  { labelKey: 'shortcuts.groups.app', ids: ['app.settings', 'daily.open-today'] },
];

function formatKeyCombo(e: KeyboardEvent): string | null {
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

type SettingsCategory = 'editor' | 'appearance' | 'files' | 'folder-colors' | 'general' | 'sync-options' | 'features' | 'shortcuts' | 'plugins' | 'wikilinks-options' | 'livepreview-options' | 'tags-options' | 'graph-options' | 'backlinks-options' | 'outline-options' | 'variables-options' | 'dailynotes-options' | 'codefolding-options' | 'highlight-options' | 'properties-options' | 'statusbar-options' | 'autosave-options' | 'spellcheck-options' | 'templates-options' | 'search-options' | 'focusmode-options' | 'wordcountgoal-options' | 'bookmarks-options' | 'typewriter-options' | 'indentguides-options' | 'imagepreview-options' | 'toc-options' | 'query-options' | 'mediaviewer-options' | 'canvas-options';

const CATEGORIES: { id: SettingsCategory; labelKey: string; icon: typeof SettingsIcon }[] = [
  { id: 'editor', labelKey: 'categories.editor', icon: Type },
  { id: 'appearance', labelKey: 'categories.appearance', icon: Palette },
  { id: 'files', labelKey: 'categories.files', icon: FolderOpen },
  { id: 'general', labelKey: 'categories.general', icon: Sliders },
  { id: 'features', labelKey: 'categories.features', icon: ToggleRight },
  { id: 'plugins', labelKey: 'categories.plugins', icon: Puzzle },
  { id: 'shortcuts', labelKey: 'categories.shortcuts', icon: Keyboard },
];

/** Feature option pages — shown in sidebar only when the feature is enabled. */
const FEATURE_OPTION_PAGES: { id: SettingsCategory; labelKey: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; settingsKey: keyof Settings }[] = [
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

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t: ts } = useTranslation('settings');
  const { shouldRender, isClosing } = useCloseAnimation(open);
  const settings = useSettingsStore();
  const [category, setCategory] = useState<SettingsCategory | string>('editor');
  const settingsTabs = usePluginStore((s) => s.settingsTabs);
  const [intervalValue, setIntervalValue] = useState(String(settings.autoSaveInterval / 1000));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [capturedKey, setCapturedKey] = useState<string>('');
  const [commands, setCommands] = useState(() => commandRegistry.getAll());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const resetDialogRef = useRef<HTMLDivElement>(null);
  const trapResetKeyDown = useFocusTrap(resetDialogRef, showResetConfirm);
  const [searchQuery, setSearchQuery] = useState('');
  const [customThemesList, setCustomThemesList] = useState<CustomTheme[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapKeyDown = useFocusTrap(dialogRef, open);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  // Load custom themes when settings opens
  const loadCustomThemes = useCallback(() => {
    if (!vaultPath) return;
    listCustomThemes(vaultPath).then((rawThemes) => {
      const themes: CustomTheme[] = [];
      for (const raw of rawThemes) {
        try {
          const parsed = JSON.parse(raw) as CustomTheme;
          if (parsed.id && parsed.name && parsed.colors) {
            registerCustomTheme(parsed);
            themes.push(parsed);
          }
        } catch { /* skip invalid */ }
      }
      setCustomThemesList(themes);
    }).catch(() => setCustomThemesList([]));
  }, [vaultPath]);

  useEffect(() => {
    if (open) loadCustomThemes();
  }, [open, loadCustomThemes]);

  // Redirect to Features if viewing a feature options page whose feature was disabled
  useEffect(() => {
    const featurePage = FEATURE_OPTION_PAGES.find((f) => f.id === category);
    if (featurePage && !(settings[featurePage.settingsKey] as boolean)) {
      setCategory('features');
    }
  }, [category, settings]);

  useEffect(() => {
    if (open) {
      setIntervalValue(String(settings.autoSaveInterval / 1000));
      setSearchQuery('');
      requestAnimationFrame(() => searchRef.current?.focus());
      setTimeout(() => { if (document.activeElement !== searchRef.current) searchRef.current?.focus(); }, 50);
    }
  }, [open, settings.autoSaveInterval]);

  useEffect(() => {
    const unsub = commandRegistry.subscribe(() => setCommands(commandRegistry.getAll()));
    return unsub;
  }, []);

  const commitInterval = useCallback(() => {
    const n = parseFloat(intervalValue);
    const ms = Math.round(n * 1000);
    if (!isNaN(ms) && ms >= 500 && ms <= 30000) {
      settings.update({ autoSaveInterval: ms });
    } else {
      setIntervalValue(String(settings.autoSaveInterval / 1000));
    }
  }, [intervalValue, settings]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingId === null) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, editingId]);

  const handleKeyCapture = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setEditingId(null);
      setCapturedKey('');
      return;
    }
    const combo = formatKeyCombo(e);
    if (combo) setCapturedKey(combo);
  }, []);

  const startEditing = useCallback((id: string) => {
    setEditingId(id);
    setCapturedKey('');
  }, []);

  const saveBinding = useCallback((id: string) => {
    if (!capturedKey) { setEditingId(null); return; }
    settings.update({ customKeybindings: { ...settings.customKeybindings, [id]: capturedKey } });
    setEditingId(null);
    setCapturedKey('');
  }, [capturedKey, settings]);

  const resetBinding = useCallback((id: string) => {
    const next = { ...settings.customKeybindings };
    delete next[id];
    settings.update({ customKeybindings: next });
  }, [settings]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setCapturedKey('');
  }, []);

  if (!shouldRender) return null;

  const shortcutCommands = Object.keys(DEFAULT_SHORTCUTS)
    .filter((id) => commands.some((c) => c.id === id))
    .map((id) => {
      const found = commands.find((c) => c.id === id);
      return {
        id,
        label: found?.label ?? id,
        defaultShortcut: DEFAULT_SHORTCUTS[id],
        customShortcut: settings.customKeybindings[id],
      };
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        animation: isClosing ? 'modal-overlay-out 0.12s ease-in forwards' : 'modal-overlay-in 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) { cancelEditing(); onClose(); }
      }}
    >
      <div
        ref={dialogRef}
        onKeyDown={trapKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={ts('title')}
        className="flex w-full rounded-xl overflow-hidden modal-content"
        style={{
          maxWidth: '64rem',
          width: '90vw',
          height: '80vh',
          backgroundColor: 'var(--ctp-mantle)',
          border: '1px solid var(--ctp-surface1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px color-mix(in srgb, var(--ctp-accent) 10%, transparent)',
          animation: isClosing ? 'modal-content-out 0.12s ease-in forwards' : 'modal-content-in 0.15s ease-out',
        }}
      >
        {/* Left sidebar */}
        <div
          className="flex flex-col shrink-0 min-h-0"
          style={{
            width: '180px',
            backgroundColor: 'var(--ctp-crust)',
            borderRight: '1px solid var(--ctp-surface0)',
          }}
        >
          {/* Sidebar header */}
          <div
            className="flex items-center gap-2 px-4 shrink-0"
            style={{ borderBottom: '1px solid var(--ctp-surface0)', height: 48 }}
          >
            <SettingsIcon size={15} style={{ color: 'var(--ctp-accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>
              {ts('title')}
            </span>
          </div>

          {/* Category list */}
          <div className="flex flex-col py-2 px-2 gap-0.5 overflow-y-auto flex-1 min-h-0 settings-sidebar-scroll">
            {CATEGORIES.map(({ id, labelKey, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCategory(id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
                style={{
                  backgroundColor: category === id ? 'var(--ctp-surface0)' : 'transparent',
                  color: category === id ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
                }}
              >
                <Icon size={14} style={{ color: category === id ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)' }} />
                {ts(labelKey)}
              </button>
            ))}

            {/* Feature option pages — only shown when the feature is enabled */}
            {FEATURE_OPTION_PAGES.filter((f) => settings[f.settingsKey] as boolean).length > 0 && (
              <div
                className="my-1 mx-2"
                style={{ borderTop: '1px solid var(--ctp-surface0)' }}
              />
            )}
            {FEATURE_OPTION_PAGES.filter((f) => settings[f.settingsKey] as boolean).map(({ id, labelKey, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCategory(id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
                style={{
                  backgroundColor: category === id ? 'var(--ctp-surface0)' : 'transparent',
                  color: category === id ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
                }}
              >
                <Icon size={14} style={{ color: category === id ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)' }} />
                {ts(labelKey)}
              </button>
            ))}


            {/* Plugin settings tabs */}
            {settingsTabs.size > 0 && (
              <div
                className="my-1 mx-2"
                style={{ borderTop: '1px solid var(--ctp-surface0)' }}
              />
            )}
            {Array.from(settingsTabs.entries()).map(([id, tab]) => (
              <button
                key={id}
                onClick={() => setCategory(id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
                style={{
                  backgroundColor: category === id ? 'var(--ctp-surface0)' : 'transparent',
                  color: category === id ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
                }}
              >
                <Puzzle size={14} style={{ color: category === id ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)' }} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Reset button */}
          <div
            className="flex items-center justify-center px-2 py-3"
            style={{ borderTop: '1px solid var(--ctp-surface0)' }}
          >
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--ctp-surface0)]"
              style={{ color: 'var(--ctp-red)' }}
              title={ts('reset.buttonTitle')}
            >
              <RotateCcw size={12} />
              {ts('reset.buttonLabel')}
            </button>
          </div>
        </div>

        {/* Right content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Content header with search */}
          <div
            className="flex items-center px-5 shrink-0"
            style={{ borderBottom: '1px solid var(--ctp-surface0)', height: 48 }}
          >
            <div
              className="flex items-center gap-2 flex-1 px-3 rounded-md"
              style={{
                backgroundColor: 'var(--ctp-surface0)',
                border: '1px solid var(--ctp-surface2)',
                height: 30,
              }}
            >
              <Search size={13} style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={ts('search.placeholder')}
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: 'var(--ctp-text)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                  className="flex items-center justify-center rounded transition-colors hover:bg-[var(--ctp-surface1)]"
                  style={{ width: 18, height: 18, color: 'var(--ctp-overlay1)', flexShrink: 0 }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Content body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <SettingsContent
              category={category}
              searchQuery={searchQuery}
              settingsTabs={settingsTabs}
              settings={settings}
              fontSize={settings.fontSize}
              fontFamily={settings.fontFamily}
              showLineNumbers={settings.showLineNumbers}

              intervalValue={intervalValue}
              setIntervalValue={setIntervalValue}
              commitInterval={commitInterval}
              shortcutCommands={shortcutCommands}
              editingId={editingId}
              capturedKey={capturedKey}
              handleKeyCapture={handleKeyCapture}
              startEditing={startEditing}
              saveBinding={saveBinding}
              resetBinding={resetBinding}
              cancelEditing={cancelEditing}
              customThemesList={customThemesList}
              vaultPath={vaultPath}
              loadCustomThemes={loadCustomThemes}
            />
          </div>
        </div>
      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowResetConfirm(false); }}
        >
          <div
            ref={resetDialogRef}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); setShowResetConfirm(false); }
              trapResetKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>);
            }}
            role="alertdialog"
            aria-modal="true"
            aria-label={ts('reset.dialogTitle')}
            className="flex flex-col rounded-lg overflow-hidden modal-content"
            style={{
              width: '320px',
              backgroundColor: 'var(--ctp-mantle)',
              border: '1px solid var(--ctp-surface1)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--ctp-surface0)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>
                {ts('reset.dialogTitle')}
              </span>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs" style={{ color: 'var(--ctp-subtext0)', lineHeight: '1.6' }}>
                {ts('reset.dialogMessage')}
              </p>
            </div>
            <div
              className="flex items-center justify-end gap-2 px-4 py-3"
              style={{ borderTop: '1px solid var(--ctp-surface0)' }}
            >
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--ctp-surface1)]"
                style={{ color: 'var(--ctp-subtext0)' }}
              >
                {ts('reset.cancel')}
              </button>
              <button
                onClick={() => { settings.reset(); setShowResetConfirm(false); }}
                className="px-3 py-1.5 rounded-md text-xs transition-colors"
                style={{ backgroundColor: 'var(--ctp-red)', color: 'var(--ctp-base)' }}
              >
                {ts('reset.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ── Searchable settings content ─────────────────────────────

interface SearchableItem {
  id: string;
  category: SettingsCategory;
  keywords: string; // searchable text
}

const SEARCHABLE_ITEMS: SearchableItem[] = [
  { id: 'fontSize', category: 'editor', keywords: 'font size pixels editor text' },
  { id: 'fontFamily', category: 'editor', keywords: 'font family monospace typeface editor' },
  { id: 'lineNumbers', category: 'editor', keywords: 'line numbers gutter editor' },

  { id: 'readableLineLength', category: 'editor', keywords: 'readable line length max width content narrow editor' },
  { id: 'theme', category: 'appearance', keywords: 'theme catppuccin mocha macchiato frappe latte dark light color' },
  { id: 'vimMode', category: 'editor', keywords: 'vim mode keybindings modal editor' },
  { id: 'tabSize', category: 'editor', keywords: 'tab size indent spaces editor' },
  { id: 'highlightActiveLine', category: 'editor', keywords: 'highlight active line cursor editor' },
  { id: 'defaultViewMode', category: 'editor', keywords: 'default view mode live source reading preview editor' },
  { id: 'spellcheck', category: 'features', keywords: 'spell check spelling editor toggle feature enable disable' },
  { id: 'codeBlockLineNumbers', category: 'editor', keywords: 'code block line numbers fenced preview' },
  { id: 'accentColor', category: 'appearance', keywords: 'accent color highlight theme appearance' },
  { id: 'sidebarPosition', category: 'appearance', keywords: 'sidebar position left right layout appearance' },
  { id: 'uiFontSize', category: 'appearance', keywords: 'ui font size interface text appearance' },
  { id: 'fileSortOrder', category: 'files', keywords: 'sort order name modified files' },
  { id: 'confirmBeforeDelete', category: 'files', keywords: 'confirm delete warning files' },
  { id: 'useTrash', category: 'files', keywords: 'trash delete permanent move files' },
  { id: 'showFileExtensions', category: 'files', keywords: 'file extensions md show hide files' },
  { id: 'showFolderIcons', category: 'files', keywords: 'folder icons show hide sidebar explorer' },
  { id: 'showFileIcons', category: 'files', keywords: 'file icons show hide sidebar explorer' },
  { id: 'folderColorSubfolders', category: 'folder-colors', keywords: 'folder color subfolders inherit children' },
  { id: 'folderColorFiles', category: 'folder-colors', keywords: 'folder color files inherit tint children' },
  { id: 'folderColorIcon', category: 'folder-colors', keywords: 'folder color icon tint' },
  { id: 'folderColorName', category: 'folder-colors', keywords: 'folder color name text label' },
  { id: 'folderColorBackground', category: 'folder-colors', keywords: 'folder color background row highlight tint' },
  { id: 'folderColorChevron', category: 'folder-colors', keywords: 'folder color chevron arrow expand collapse' },
  { id: 'folderColorFileIcon', category: 'folder-colors', keywords: 'file color icon tint inherit' },
  { id: 'folderColorFileName', category: 'folder-colors', keywords: 'file color name text label inherit' },
  { id: 'folderColorFileBackground', category: 'folder-colors', keywords: 'file color background row highlight tint inherit' },
  { id: 'folderColorStyle', category: 'folder-colors', keywords: 'folder color style preset mode icon text background accent dot' },
  { id: 'folderColorFileStyle', category: 'folder-colors', keywords: 'file color style preset mode icon text background accent dot' },
  { id: 'folderColorBold', category: 'folder-colors', keywords: 'folder color bold font weight' },
  { id: 'folderColorOpacity', category: 'folder-colors', keywords: 'folder color opacity intensity transparency' },
  { id: 'templatesFolder', category: 'files', keywords: 'templates folder path directory files new note' },
  { id: 'attachmentLocation', category: 'files', keywords: 'attachment image paste location folder files' },
  { id: 'attachmentsFolder', category: 'files', keywords: 'attachments folder path directory files' },
  { id: 'autoSaveEnabled', category: 'features', keywords: 'auto save enable disable general toggle feature' },
  { id: 'language', category: 'general', keywords: 'language display interface locale general' },
  { id: 'startupBehavior', category: 'general', keywords: 'startup behavior reopen last vault picker general' },
  { id: 'enableFolderColors', category: 'features', keywords: 'folder colors coloring toggle feature enable disable' },
  { id: 'enableWikiLinks', category: 'features', keywords: 'wiki links wikilinks toggle feature enable disable' },
  { id: 'enableLivePreview', category: 'features', keywords: 'live preview toggle feature enable disable decorations' },
  { id: 'enableTags', category: 'features', keywords: 'tags hashtags toggle feature enable disable' },
  { id: 'enableGraphView', category: 'features', keywords: 'graph view toggle feature enable disable network' },
  { id: 'enableBacklinks', category: 'features', keywords: 'backlinks references toggle feature enable disable' },
  { id: 'enableOutline', category: 'features', keywords: 'outline headings toc toggle feature enable disable' },
  { id: 'enableVariables', category: 'features', keywords: 'variables template frontmatter replacement toggle feature enable disable' },
  { id: 'wikilinksOptions', category: 'wikilinks-options' as SettingsCategory, keywords: 'wiki links open new tab full path create follow options' },
  { id: 'livepreviewOptions', category: 'livepreview-options' as SettingsCategory, keywords: 'live preview headings bold italic links images code blocks render options' },
  { id: 'tagsOptions', category: 'tags-options' as SettingsCategory, keywords: 'tags autocomplete nested support hashtags options' },
  { id: 'graphOptions', category: 'graph-options' as SettingsCategory, keywords: 'graph node size link distance orphans max nodes view options' },
  { id: 'backlinksOptions', category: 'backlinks-options' as SettingsCategory, keywords: 'backlinks context lines group folder references options' },
  { id: 'outlineOptions', category: 'outline-options' as SettingsCategory, keywords: 'outline heading level auto expand toc options' },
  { id: 'variablesOptions', category: 'variables-options' as SettingsCategory, keywords: 'variables delimiter separator missing nesting case insensitive array join preserve options' },
  { id: 'enableDailyNotes', category: 'features', keywords: 'daily notes toggle feature enable disable' },
  { id: 'dailynotesOptions', category: 'dailynotes-options' as SettingsCategory, keywords: 'daily notes folder date format template options' },
  { id: 'enableCodeFolding', category: 'features', keywords: 'code folding fold headings collapse toggle feature enable disable' },
  { id: 'enableHighlightSyntax', category: 'features', keywords: 'highlight syntax marker toggle feature enable disable' },
  { id: 'enableProperties', category: 'features', keywords: 'properties frontmatter yaml widget toggle feature enable disable' },
  { id: 'enableStatusBar', category: 'features', keywords: 'status bar word count toggle feature enable disable' },
  { id: 'enableTemplates', category: 'features', keywords: 'templates variables toggle feature enable disable' },
  { id: 'enableSearch', category: 'features', keywords: 'search vault find toggle feature enable disable' },
  { id: 'enableFocusMode', category: 'features', keywords: 'focus mode zen distraction free toggle feature enable disable' },
  { id: 'enableWordCountGoal', category: 'features', keywords: 'word count goal target writing toggle feature enable disable' },
  { id: 'enableBookmarks', category: 'features', keywords: 'bookmarks favorites star files toggle feature enable disable' },
  { id: 'enableCanvas', category: 'features', keywords: 'canvas whiteboard visual cards nodes edges toggle feature enable disable' },
  { id: 'enableTypewriterMode', category: 'features', keywords: 'typewriter mode cursor center scroll toggle feature enable disable' },
  { id: 'enableIndentGuides', category: 'features', keywords: 'indent guides lines vertical indentation toggle feature enable disable' },
  { id: 'enableImagePreview', category: 'features', keywords: 'image preview inline pictures toggle feature enable disable' },
  { id: 'enableMathPreview', category: 'features', keywords: 'math latex katex equation preview toggle feature enable disable' },
  { id: 'enableCalloutPreview', category: 'features', keywords: 'callout admonition alert note warning preview toggle feature enable disable' },
  { id: 'enableMediaViewer', category: 'features', keywords: 'media viewer image pdf picture toggle feature enable disable' },
  { id: 'enableMermaidPreview', category: 'features', keywords: 'mermaid diagram chart flowchart preview toggle feature enable disable' },
  { id: 'enableQueryPreview', category: 'features', keywords: 'query dataview table list properties filter sort preview toggle feature enable disable' },
  { id: 'enableTableOfContents', category: 'features', keywords: 'table of contents toc headings toggle feature enable disable' },
  { id: 'focusmodeOptions', category: 'focusmode-options' as SettingsCategory, keywords: 'focus mode dim paragraphs typewriter zen options' },
  { id: 'wordcountgoalOptions', category: 'wordcountgoal-options' as SettingsCategory, keywords: 'word count goal target status bar notification options' },
  { id: 'canvasOptions', category: 'canvas-options' as SettingsCategory, keywords: 'canvas whiteboard visual cards nodes edges options' },
  { id: 'bookmarksOptions', category: 'bookmarks-options' as SettingsCategory, keywords: 'bookmarks favorites star files options' },
  { id: 'typewriterOptions', category: 'typewriter-options' as SettingsCategory, keywords: 'typewriter mode offset cursor center scroll options' },
  { id: 'indentguidesOptions', category: 'indentguides-options' as SettingsCategory, keywords: 'indent guides color style solid dashed dotted options' },
  { id: 'imagepreviewOptions', category: 'imagepreview-options' as SettingsCategory, keywords: 'image preview max height inline options' },
  { id: 'mediaviewerOptions', category: 'mediaviewer-options' as SettingsCategory, keywords: 'media viewer pdf image zoom default options' },
  { id: 'tocOptions', category: 'toc-options' as SettingsCategory, keywords: 'table of contents toc auto update save headings options' },
  { id: 'queryOptions', category: 'query-options' as SettingsCategory, keywords: 'query dataview table list properties filter sort from where limit options' },
  { id: 'codefoldingOptions', category: 'codefolding-options' as SettingsCategory, keywords: 'code folding headings code blocks minimum level options' },
  { id: 'highlightOptions', category: 'highlight-options' as SettingsCategory, keywords: 'highlight color marker options' },
  { id: 'propertiesOptions', category: 'properties-options' as SettingsCategory, keywords: 'properties frontmatter show types options' },
  { id: 'statusbarOptions', category: 'statusbar-options' as SettingsCategory, keywords: 'status bar words chars reading time selection options' },
  { id: 'autosaveOptions', category: 'autosave-options' as SettingsCategory, keywords: 'auto save interval delay timer options' },
  { id: 'spellcheckOptions', category: 'spellcheck-options' as SettingsCategory, keywords: 'spell check spelling browser options' },
  { id: 'templatesOptions', category: 'templates-options' as SettingsCategory, keywords: 'templates folder variables cursor clipboard date options' },
  { id: 'searchOptions', category: 'search-options' as SettingsCategory, keywords: 'search case sensitive regex whole word options' },
  { id: 'syncOptions', category: 'sync-options' as SettingsCategory, keywords: 'sync github git repository backup cloud push pull auto-sync interval token' },
  { id: 'syncEnabled', category: 'features', keywords: 'sync github git cloud backup toggle feature enable disable' },
];

interface SettingsContentProps {
  category: SettingsCategory | string;
  searchQuery: string;
  settingsTabs: Map<string, { pluginId: string; label: string; html: string }>;
  settings: Settings & { update: (partial: Partial<Settings>) => void; reset: () => void; getShortcut: (commandId: string, defaultShortcut: string) => string };
  fontSize: number;
  fontFamily: string;
  showLineNumbers: boolean;

  intervalValue: string;
  setIntervalValue: (v: string) => void;
  commitInterval: () => void;
  shortcutCommands: { id: string; label: string; defaultShortcut: string; customShortcut?: string }[];
  editingId: string | null;
  capturedKey: string;
  handleKeyCapture: (e: KeyboardEvent) => void;
  startEditing: (id: string) => void;
  saveBinding: (id: string) => void;
  resetBinding: (id: string) => void;
  cancelEditing: () => void;
  customThemesList: CustomTheme[];
  vaultPath: string | null;
  loadCustomThemes: () => void;
}

function SettingsContent(props: SettingsContentProps) {
  const { t: ts } = useTranslation('settings');
  const {
    category, searchQuery, settings, intervalValue, setIntervalValue, commitInterval,
    shortcutCommands, editingId, capturedKey, handleKeyCapture,
    startEditing, saveBinding, resetBinding, cancelEditing,
    customThemesList, vaultPath, loadCustomThemes, settingsTabs,
  } = props;

  // Render plugin settings tab iframe if this is a plugin tab
  if (settingsTabs.has(category as string)) {
    const tab = settingsTabs.get(category as string)!;
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 20px 16px' }}>
        <iframe
          srcDoc={tab.html}
          sandbox="allow-scripts"
          className="w-full"
          style={{ border: 'none', minHeight: 400 }}
          title={`Plugin settings: ${tab.label}`}
        />
      </div>
    );
  }

  const q = searchQuery.toLowerCase().trim();
  const isSearching = q.length > 0;

  // Filter items
  const matchItem = (item: SearchableItem) => item.keywords.includes(q);
  const matchShortcut = (sc: typeof shortcutCommands[0]) =>
    sc.label.toLowerCase().includes(q) || sc.defaultShortcut.toLowerCase().includes(q) || 'shortcut keyboard'.includes(q);

  const showEditor = isSearching ? SEARCHABLE_ITEMS.filter((i) => i.category === 'editor' && matchItem(i)) : null;
  const showAppearance = isSearching ? SEARCHABLE_ITEMS.filter((i) => i.category === 'appearance' && matchItem(i)) : null;
  const showFiles = isSearching ? SEARCHABLE_ITEMS.filter((i) => i.category === 'files' && matchItem(i)) : null;
  const showFolderColors = isSearching ? SEARCHABLE_ITEMS.filter((i) => i.category === 'folder-colors' && matchItem(i)) : null;
  const showGeneral = isSearching ? SEARCHABLE_ITEMS.filter((i) => i.category === 'general' && matchItem(i)) : null;
  const showFeatures = isSearching ? SEARCHABLE_ITEMS.filter((i) => i.category === 'features' && matchItem(i)) : null;
  const showShortcuts = isSearching ? shortcutCommands.filter(matchShortcut) : null;

  const shouldShowCategory = (cat: SettingsCategory) => {
    if (!isSearching) return category === cat;
    if (cat === 'editor') return showEditor!.length > 0;
    if (cat === 'appearance') return showAppearance!.length > 0;
    if (cat === 'files') return showFiles!.length > 0;
    if (cat === 'folder-colors') return showFolderColors!.length > 0;
    if (cat === 'general') return showGeneral!.length > 0;
    if (cat === 'sync-options') return SEARCHABLE_ITEMS.filter((i) => i.category === 'sync-options' && matchItem(i)).length > 0;
    if (cat === 'features') return showFeatures!.length > 0;
    if (cat === 'shortcuts') return showShortcuts!.length > 0;
    if (cat === 'plugins') return 'plugins'.includes(q);
    // Feature option pages — only show if the parent feature is enabled
    const featurePage = FEATURE_OPTION_PAGES.find((p) => p.id === cat);
    if (featurePage) {
      if (!settings[featurePage.settingsKey as keyof typeof settings]) return false;
      const optItems = SEARCHABLE_ITEMS.filter((i) => i.category === cat && matchItem(i));
      return optItems.length > 0;
    }
    return false;
  };

  const visibleIds = (cat: SettingsCategory) => {
    if (!isSearching) return null;
    const items = SEARCHABLE_ITEMS.filter((i) => i.category === cat && matchItem(i));
    return new Set(items.map((i) => i.id));
  };
  const visibleEditorIds = visibleIds('editor');
  const visibleAppearanceIds = visibleIds('appearance');
  const visibleFilesIds = visibleIds('files');
  const visibleFolderColorsIds = visibleIds('folder-colors');
  const visibleGeneralIds = visibleIds('general');
  const visibleFeaturesIds = visibleIds('features');

  const noResults = isSearching && !shouldShowCategory('editor') && !shouldShowCategory('appearance') && !shouldShowCategory('files') && !shouldShowCategory('folder-colors') && !shouldShowCategory('general') && !shouldShowCategory('sync-options') && !shouldShowCategory('features') && !shouldShowCategory('plugins') && !shouldShowCategory('shortcuts') && !shouldShowCategory('wikilinks-options') && !shouldShowCategory('livepreview-options') && !shouldShowCategory('tags-options') && !shouldShowCategory('graph-options') && !shouldShowCategory('backlinks-options') && !shouldShowCategory('outline-options') && !shouldShowCategory('variables-options') && !shouldShowCategory('dailynotes-options') && !shouldShowCategory('codefolding-options') && !shouldShowCategory('highlight-options') && !shouldShowCategory('properties-options') && !shouldShowCategory('statusbar-options') && !shouldShowCategory('autosave-options') && !shouldShowCategory('spellcheck-options') && !shouldShowCategory('templates-options') && !shouldShowCategory('search-options') && !shouldShowCategory('focusmode-options') && !shouldShowCategory('wordcountgoal-options') && !shouldShowCategory('bookmarks-options') && !shouldShowCategory('typewriter-options') && !shouldShowCategory('indentguides-options') && !shouldShowCategory('imagepreview-options') && !shouldShowCategory('toc-options');

  if (noResults) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{ts('search.noResults')}</span>
      </div>
    );
  }

  const SectionHeader = ({ label }: { label: string }) => (
    <div
      className="text-xs font-medium mb-2 mt-1 pb-1"
      style={{ color: 'var(--ctp-overlay1)', borderBottom: '1px solid var(--ctp-surface0)' }}
    >
      {label}
    </div>
  );

  const SubHeader = ({ label }: { label: string }) => (
    <div
      className="text-[0.65rem] font-semibold uppercase tracking-wider mt-2 mb-1"
      style={{ color: 'var(--ctp-accent)' }}
    >
      {label}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {shouldShowCategory('editor') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.editor')} />}
          {!isSearching && <SubHeader label={ts('editor.subheaders.text')} />}
          {(!visibleEditorIds || visibleEditorIds.has('fontSize')) && (
            <SettingRow label={ts('editor.fontSize.label')} description={ts('editor.fontSize.description')} onReset={settings.fontSize !== DEFAULTS.fontSize ? () => settings.update({ fontSize: DEFAULTS.fontSize }) : undefined}>
              <select
                value={settings.fontSize}
                onChange={(e) => settings.update({ fontSize: Number(e.target.value) })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                {Array.from({ length: 15 }, (_, i) => i + 10).map((size) => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
            </SettingRow>
          )}
          {(!visibleEditorIds || visibleEditorIds.has('fontFamily')) && (
            <SettingRow label={ts('editor.fontFamily.label')} description={ts('editor.fontFamily.description')}>
              <select
                value={settings.fontFamily}
                onChange={(e) => settings.update({ fontFamily: e.target.value })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{fontLabel(f)}</option>
                ))}
              </select>
            </SettingRow>
          )}
          {!isSearching && <SubHeader label={ts('editor.subheaders.display')} />}
          {(!visibleEditorIds || visibleEditorIds.has('lineNumbers')) && (
            <SettingRow label={ts('editor.lineNumbers.label')} description={ts('editor.lineNumbers.description')}>
              <ToggleSwitch
                checked={settings.showLineNumbers}
                onChange={(v) => settings.update({ showLineNumbers: v })}
              />
            </SettingRow>
          )}

          {(!visibleEditorIds || visibleEditorIds.has('readableLineLength')) && (
            <SettingRow label={ts('editor.readableLineLength.label')} description={ts('editor.readableLineLength.description')}>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={50}
                  value={settings.readableLineLength}
                  onChange={(e) => settings.update({ readableLineLength: Number(e.target.value) })}
                  className="w-28 accent-[var(--ctp-accent)]"
                />
                <span className="text-xs w-12 text-right" style={{ color: 'var(--ctp-subtext0)' }}>
                  {settings.readableLineLength === 0 ? ts('editor.readableLineLength.off') : `${settings.readableLineLength}px`}
                </span>
              </div>
            </SettingRow>
          )}
          {!isSearching && <SubHeader label={ts('editor.subheaders.editing')} />}
          {(!visibleEditorIds || visibleEditorIds.has('vimMode')) && (
            <SettingRow label={ts('editor.vimMode.label')} description={ts('editor.vimMode.description')}>
              <ToggleSwitch
                checked={settings.vimMode}
                onChange={(v) => settings.update({ vimMode: v })}
              />
            </SettingRow>
          )}
          {(!visibleEditorIds || visibleEditorIds.has('tabSize')) && (
            <SettingRow label={ts('editor.tabSize.label')} description={ts('editor.tabSize.description')}>
              <select
                value={settings.tabSize}
                onChange={(e) => settings.update({ tabSize: Number(e.target.value) })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                <option value={2}>{ts('editor.tabSize.twoSpaces')}</option>
                <option value={4}>{ts('editor.tabSize.fourSpaces')}</option>
              </select>
            </SettingRow>
          )}
          {(!visibleEditorIds || visibleEditorIds.has('highlightActiveLine')) && (
            <SettingRow label={ts('editor.highlightActiveLine.label')} description={ts('editor.highlightActiveLine.description')}>
              <ToggleSwitch
                checked={settings.highlightActiveLine}
                onChange={(v) => settings.update({ highlightActiveLine: v })}
              />
            </SettingRow>
          )}
          {(!visibleEditorIds || visibleEditorIds.has('defaultViewMode')) && (
            <SettingRow label={ts('editor.defaultViewMode.label')} description={ts('editor.defaultViewMode.description')}>
              <select
                value={settings.defaultViewMode}
                onChange={(e) => settings.update({ defaultViewMode: e.target.value as ViewMode })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                <option value="live">{ts('editor.defaultViewMode.live')}</option>
                <option value="source">{ts('editor.defaultViewMode.source')}</option>
                <option value="reading">{ts('editor.defaultViewMode.reading')}</option>
              </select>
            </SettingRow>
          )}
          {!isSearching && <SubHeader label={ts('editor.subheaders.other')} />}
          {(!visibleEditorIds || visibleEditorIds.has('codeBlockLineNumbers')) && (
            <SettingRow label={ts('editor.codeBlockLineNumbers.label')} description={ts('editor.codeBlockLineNumbers.description')}>
              <ToggleSwitch
                checked={settings.codeBlockLineNumbers}
                onChange={(v) => settings.update({ codeBlockLineNumbers: v })}
              />
            </SettingRow>
          )}
        </>
      )}

      {shouldShowCategory('appearance') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.appearance')} />}
          {!isSearching && <SubHeader label={ts('appearance.subheaders.theme')} />}
          {(!visibleAppearanceIds || visibleAppearanceIds.has('theme')) && (
            <SettingRow label={ts('appearance.theme.label')} description={ts('appearance.theme.description')}>
              <div className="flex items-center gap-2">
                <select
                  value={settings.theme}
                  onChange={(e) => settings.update({ theme: e.target.value })}
                  className="text-xs px-2 py-1 rounded outline-none"
                  style={{
                    backgroundColor: 'var(--ctp-surface0)',
                    color: 'var(--ctp-text)',
                    border: '1px solid var(--ctp-surface2)',
                  }}
                >
                  <optgroup label={ts('appearance.theme.catppuccin')}>
                    {['mocha', 'macchiato', 'frappe', 'latte'].map((f) => (
                      <option key={f} value={f}>{flavorLabels[f]}</option>
                    ))}
                  </optgroup>
                  <optgroup label={ts('appearance.theme.dark')}>
                    {['nord', 'dracula', 'gruvbox-dark', 'tokyo-night', 'one-dark', 'solarized-dark', 'rose-pine-moon'].map((f) => (
                      <option key={f} value={f}>{flavorLabels[f]}</option>
                    ))}
                  </optgroup>
                  <optgroup label={ts('appearance.theme.light')}>
                    {['gruvbox-light', 'solarized-light', 'rose-pine-dawn'].map((f) => (
                      <option key={f} value={f}>{flavorLabels[f]}</option>
                    ))}
                  </optgroup>
                  {customThemesList.length > 0 && (
                    <optgroup label={ts('appearance.theme.custom')}>
                      {customThemesList.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{
                    backgroundColor: 'var(--ctp-surface0)',
                    color: 'var(--ctp-accent)',
                    border: '1px solid var(--ctp-surface2)',
                  }}
                  onClick={async () => {
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
                          alert(ts('appearance.theme.invalidThemeFile'));
                          return;
                        }
                        // Validate that colors has all required keys
                        const requiredKeys: (keyof FlavorColors)[] = [
                          'rosewater','flamingo','pink','mauve','red','maroon','peach','yellow',
                          'green','teal','sky','sapphire','blue','lavender','text','subtext1',
                          'subtext0','overlay2','overlay1','overlay0','surface2','surface1',
                          'surface0','base','mantle','crust',
                        ];
                        const missing = requiredKeys.filter((k) => !parsed.colors[k]);
                        if (missing.length > 0) {
                          alert(ts('appearance.theme.missingColors', { colors: missing.join(', ') }));
                          return;
                        }
                        await saveCustomTheme(vaultPath, parsed.id, text);
                        registerCustomTheme(parsed);
                        loadCustomThemes();
                        settings.update({ theme: parsed.id });
                      } catch {
                        alert(ts('appearance.theme.parseError'));
                      }
                    };
                    input.click();
                  }}
                >
                  {ts('appearance.theme.installTheme')}
                </button>
                {customThemesList.some((t) => t.id === settings.theme) && (
                  <button
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      backgroundColor: 'var(--ctp-surface0)',
                      color: 'var(--ctp-red)',
                      border: '1px solid var(--ctp-surface2)',
                    }}
                    onClick={async () => {
                      if (!vaultPath) return;
                      const themeId = settings.theme;
                      await deleteCustomTheme(vaultPath, themeId);
                      unregisterCustomTheme(themeId);
                      settings.update({ theme: 'mocha' });
                      loadCustomThemes();
                    }}
                  >
                    {ts('appearance.theme.deleteTheme')}
                  </button>
                )}
              </div>
            </SettingRow>
          )}
          {!isSearching && <SubHeader label={ts('appearance.subheaders.colors')} />}
          {(!visibleAppearanceIds || visibleAppearanceIds.has('accentColor')) && (
            <SettingRow label={ts('appearance.accentColor.label')} description={ts('appearance.accentColor.description')}>
              <AccentColorPicker
                value={settings.accentColor}
                onChange={(v) => settings.update({ accentColor: v })}
              />
            </SettingRow>
          )}
          {!isSearching && <SubHeader label={ts('appearance.subheaders.layout')} />}
          {(!visibleAppearanceIds || visibleAppearanceIds.has('sidebarPosition')) && (
            <SettingRow label={ts('appearance.sidebarPosition.label')} description={ts('appearance.sidebarPosition.description')}>
              <select
                value={settings.sidebarPosition}
                onChange={(e) => settings.update({ sidebarPosition: e.target.value as 'left' | 'right' })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                <option value="left">{ts('appearance.sidebarPosition.left')}</option>
                <option value="right">{ts('appearance.sidebarPosition.right')}</option>
              </select>
            </SettingRow>
          )}
          {(!visibleAppearanceIds || visibleAppearanceIds.has('uiFontSize')) && (
            <SettingRow label={ts('appearance.uiFontSize.label')} description={ts('appearance.uiFontSize.description')}>
              <UiFontSizeSlider value={settings.uiFontSize} onCommit={(v) => settings.update({ uiFontSize: v })} />
            </SettingRow>
          )}
          {!isSearching && <CommunityThemesSection />}
        </>
      )}

      {shouldShowCategory('files') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.files')} />}
          {!isSearching && <SubHeader label={ts('files.subheaders.explorer')} />}
          {(!visibleFilesIds || visibleFilesIds.has('fileSortOrder')) && (
            <SettingRow label={ts('files.sortOrder.label')} description={ts('files.sortOrder.description')}>
              <select
                value={settings.fileSortOrder}
                onChange={(e) => settings.update({ fileSortOrder: e.target.value as FileSortOrder })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                <option value="name-asc">{ts('files.sortOrder.nameAsc')}</option>
                <option value="name-desc">{ts('files.sortOrder.nameDesc')}</option>
                <option value="modified-newest">{ts('files.sortOrder.modifiedNewest')}</option>
                <option value="modified-oldest">{ts('files.sortOrder.modifiedOldest')}</option>
              </select>
            </SettingRow>
          )}
          {(!visibleFilesIds || visibleFilesIds.has('showFileExtensions')) && (
            <SettingRow label={ts('files.showFileExtensions.label')} description={ts('files.showFileExtensions.description')}>
              <ToggleSwitch
                checked={settings.showFileExtensions}
                onChange={(v) => settings.update({ showFileExtensions: v })}
              />
            </SettingRow>
          )}
          {(!visibleFilesIds || visibleFilesIds.has('showFolderIcons')) && (
            <SettingRow label={ts('files.showFolderIcons.label')} description={ts('files.showFolderIcons.description')}>
              <ToggleSwitch
                checked={settings.showFolderIcons}
                onChange={(v) => settings.update({ showFolderIcons: v })}
              />
            </SettingRow>
          )}
          {(!visibleFilesIds || visibleFilesIds.has('showFileIcons')) && (
            <SettingRow label={ts('files.showFileIcons.label')} description={ts('files.showFileIcons.description')}>
              <ToggleSwitch
                checked={settings.showFileIcons}
                onChange={(v) => settings.update({ showFileIcons: v })}
              />
            </SettingRow>
          )}
          {!isSearching && <SubHeader label={ts('files.subheaders.deletion')} />}
          {(!visibleFilesIds || visibleFilesIds.has('confirmBeforeDelete')) && (
            <SettingRow label={ts('files.confirmBeforeDelete.label')} description={ts('files.confirmBeforeDelete.description')}>
              <ToggleSwitch
                checked={settings.confirmBeforeDelete}
                onChange={(v) => settings.update({ confirmBeforeDelete: v })}
              />
            </SettingRow>
          )}
          {(!visibleFilesIds || visibleFilesIds.has('useTrash')) && (
            <SettingRow label={ts('files.moveToTrash.label')} description={ts('files.moveToTrash.description')}>
              <ToggleSwitch
                checked={settings.useTrash}
                onChange={(v) => settings.update({ useTrash: v })}
              />
            </SettingRow>
          )}
          {!isSearching && <SubHeader label={ts('files.subheaders.attachmentsTemplates')} />}
          {(!visibleFilesIds || visibleFilesIds.has('templatesFolder')) && (
            <SettingRow label={ts('files.templatesFolder.label')} description={ts('files.templatesFolder.description')}>
              <input
                type="text"
                value={settings.templatesFolder}
                onChange={(e) => settings.update({ templatesFolder: e.target.value })}
                className="text-xs px-2 py-1 rounded outline-none w-32"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
                placeholder={ts('files.templatesFolder.placeholder')}
              />
            </SettingRow>
          )}
          {(!visibleFilesIds || visibleFilesIds.has('attachmentLocation')) && (
            <SettingRow label={ts('files.attachmentLocation.label')} description={ts('files.attachmentLocation.description')}>
              <select
                value={settings.attachmentLocation}
                onChange={(e) => settings.update({ attachmentLocation: e.target.value as AttachmentLocation })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                <option value="vault-folder">{ts('files.attachmentLocation.vaultFolder')}</option>
                <option value="same-folder">{ts('files.attachmentLocation.sameFolder')}</option>
              </select>
            </SettingRow>
          )}
          {(!visibleFilesIds || visibleFilesIds.has('attachmentsFolder')) && settings.attachmentLocation === 'vault-folder' && (
            <SettingRow label={ts('files.attachmentsFolder.label')} description={ts('files.attachmentsFolder.description')}>
              <input
                type="text"
                value={settings.attachmentsFolder}
                onChange={(e) => settings.update({ attachmentsFolder: e.target.value })}
                className="text-xs px-2 py-1 rounded outline-none w-32"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
                placeholder={ts('files.attachmentsFolder.placeholder')}
              />
            </SettingRow>
          )}
        </>
      )}

      {shouldShowCategory('general') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.general')} />}
          {(!visibleGeneralIds || visibleGeneralIds.has('language')) && (
            <SettingRow label={ts('general.language.label')} description={ts('general.language.description')}>
              <select
                value={settings.language}
                onChange={(e) => settings.update({ language: e.target.value })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                <option value="en">English</option>
              </select>
            </SettingRow>
          )}
          {!isSearching && <SubHeader label={ts('general.subheaders.startup')} />}
          {(!visibleGeneralIds || visibleGeneralIds.has('startupBehavior')) && (
            <SettingRow label={ts('general.onStartup.label')} description={ts('general.onStartup.description')}>
              <select
                value={settings.startupBehavior}
                onChange={(e) => settings.update({ startupBehavior: e.target.value as StartupBehavior })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                <option value="reopen-last">{ts('general.onStartup.reopenLast')}</option>
                <option value="show-picker">{ts('general.onStartup.showPicker')}</option>
              </select>
            </SettingRow>
          )}
        </>
      )}

      {shouldShowCategory('features') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.features')} />}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('autoSaveEnabled')) && (
            <SettingRow label={ts('features.autoSave.label')} description={ts('features.autoSave.description')}>
              <ToggleSwitch
                checked={settings.autoSaveEnabled}
                onChange={(v) => settings.update({ autoSaveEnabled: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableBacklinks')) && (
            <SettingRow label={ts('features.backlinks.label')} description={ts('features.backlinks.description')}>
              <ToggleSwitch
                checked={settings.enableBacklinks}
                onChange={(v) => settings.update({ enableBacklinks: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableBookmarks')) && (
            <SettingRow label={ts('features.bookmarks.label')} description={ts('features.bookmarks.description')}>
              <ToggleSwitch
                checked={settings.enableBookmarks}
                onChange={(v) => settings.update({ enableBookmarks: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableCalloutPreview')) && (
            <SettingRow label={ts('features.calloutPreview.label')} description={ts('features.calloutPreview.description')}>
              <ToggleSwitch
                checked={settings.enableCalloutPreview}
                onChange={(v) => settings.update({ enableCalloutPreview: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableCanvas')) && (
            <SettingRow label={ts('features.canvas.label')} description={ts('features.canvas.description')}>
              <ToggleSwitch
                checked={settings.enableCanvas}
                onChange={(v) => settings.update({ enableCanvas: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableCodeFolding')) && (
            <SettingRow label={ts('features.codeFolding.label')} description={ts('features.codeFolding.description')}>
              <ToggleSwitch
                checked={settings.enableCodeFolding}
                onChange={(v) => settings.update({ enableCodeFolding: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableDailyNotes')) && (
            <SettingRow label={ts('features.dailyNotes.label')} description={ts('features.dailyNotes.description')}>
              <ToggleSwitch
                checked={settings.enableDailyNotes}
                onChange={(v) => settings.update({ enableDailyNotes: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableFocusMode')) && (
            <SettingRow label={ts('features.focusMode.label')} description={ts('features.focusMode.description')}>
              <ToggleSwitch
                checked={settings.enableFocusMode}
                onChange={(v) => settings.update({ enableFocusMode: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableFolderColors')) && (
            <SettingRow label={ts('features.folderColors.label')} description={ts('features.folderColors.description')}>
              <ToggleSwitch
                checked={settings.enableFolderColors}
                onChange={(v) => settings.update({ enableFolderColors: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableGraphView')) && (
            <SettingRow label={ts('features.graphView.label')} description={ts('features.graphView.description')}>
              <ToggleSwitch
                checked={settings.enableGraphView}
                onChange={(v) => settings.update({ enableGraphView: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableHighlightSyntax')) && (
            <SettingRow label={ts('features.highlightSyntax.label')} description={ts('features.highlightSyntax.description')}>
              <ToggleSwitch
                checked={settings.enableHighlightSyntax}
                onChange={(v) => settings.update({ enableHighlightSyntax: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableImagePreview')) && (
            <SettingRow label={ts('features.imagePreview.label')} description={ts('features.imagePreview.description')}>
              <ToggleSwitch
                checked={settings.enableImagePreview}
                onChange={(v) => settings.update({ enableImagePreview: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableIndentGuides')) && (
            <SettingRow label={ts('features.indentGuides.label')} description={ts('features.indentGuides.description')}>
              <ToggleSwitch
                checked={settings.enableIndentGuides}
                onChange={(v) => settings.update({ enableIndentGuides: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableLivePreview')) && (
            <SettingRow label={ts('features.livePreview.label')} description={ts('features.livePreview.description')}>
              <ToggleSwitch
                checked={settings.enableLivePreview}
                onChange={(v) => settings.update({ enableLivePreview: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableMathPreview')) && (
            <SettingRow label={ts('features.mathPreview.label')} description={ts('features.mathPreview.description')}>
              <ToggleSwitch
                checked={settings.enableMathPreview}
                onChange={(v) => settings.update({ enableMathPreview: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableMediaViewer')) && (
            <SettingRow label={ts('features.mediaViewer.label')} description={ts('features.mediaViewer.description')}>
              <ToggleSwitch
                checked={settings.enableMediaViewer}
                onChange={(v) => settings.update({ enableMediaViewer: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableMermaidPreview')) && (
            <SettingRow label={ts('features.mermaidDiagrams.label')} description={ts('features.mermaidDiagrams.description')}>
              <ToggleSwitch
                checked={settings.enableMermaidPreview}
                onChange={(v) => settings.update({ enableMermaidPreview: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableOutline')) && (
            <SettingRow label={ts('features.outline.label')} description={ts('features.outline.description')}>
              <ToggleSwitch
                checked={settings.enableOutline}
                onChange={(v) => settings.update({ enableOutline: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableProperties')) && (
            <SettingRow label={ts('features.propertiesWidget.label')} description={ts('features.propertiesWidget.description')}>
              <ToggleSwitch
                checked={settings.enableProperties}
                onChange={(v) => settings.update({ enableProperties: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableQueryPreview')) && (
            <SettingRow label={ts('features.queryPreview.label')} description={ts('features.queryPreview.description')}>
              <ToggleSwitch
                checked={settings.enableQueryPreview}
                onChange={(v) => settings.update({ enableQueryPreview: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableSearch')) && (
            <SettingRow label={ts('features.searchInVault.label')} description={ts('features.searchInVault.description')}>
              <ToggleSwitch
                checked={settings.enableSearch}
                onChange={(v) => settings.update({ enableSearch: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('spellcheck')) && (
            <SettingRow label={ts('features.spellcheck.label')} description={ts('features.spellcheck.description')}>
              <ToggleSwitch
                checked={settings.spellcheck}
                onChange={(v) => settings.update({ spellcheck: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableStatusBar')) && (
            <SettingRow label={ts('features.statusBar.label')} description={ts('features.statusBar.description')}>
              <ToggleSwitch
                checked={settings.enableStatusBar}
                onChange={(v) => settings.update({ enableStatusBar: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('syncEnabled')) && (
            <SettingRow label={ts('features.sync.label')} description={ts('features.sync.description')}>
              <ToggleSwitch
                checked={settings.syncEnabled}
                onChange={(v) => settings.update({ syncEnabled: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableTableOfContents')) && (
            <SettingRow label={ts('features.tableOfContents.label')} description={ts('features.tableOfContents.description')}>
              <ToggleSwitch
                checked={settings.enableTableOfContents}
                onChange={(v) => settings.update({ enableTableOfContents: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableTags')) && (
            <SettingRow label={ts('features.tags.label')} description={ts('features.tags.description')}>
              <ToggleSwitch
                checked={settings.enableTags}
                onChange={(v) => settings.update({ enableTags: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableTemplates')) && (
            <SettingRow label={ts('features.templates.label')} description={ts('features.templates.description')}>
              <ToggleSwitch
                checked={settings.enableTemplates}
                onChange={(v) => settings.update({ enableTemplates: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableTypewriterMode')) && (
            <SettingRow label={ts('features.typewriterMode.label')} description={ts('features.typewriterMode.description')}>
              <ToggleSwitch
                checked={settings.enableTypewriterMode}
                onChange={(v) => settings.update({ enableTypewriterMode: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableVariables')) && (
            <SettingRow label={ts('features.variables.label')} description={ts('features.variables.description')}>
              <ToggleSwitch
                checked={settings.enableVariables}
                onChange={(v) => settings.update({ enableVariables: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('showWelcomeView')) && (
            <SettingRow label={ts('features.welcomeView.label')} description={ts('features.welcomeView.description')}>
              <ToggleSwitch
                checked={settings.showWelcomeView}
                onChange={(v) => settings.update({ showWelcomeView: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableWikiLinks')) && (
            <SettingRow label={ts('features.wikiLinks.label')} description={ts('features.wikiLinks.description')}>
              <ToggleSwitch
                checked={settings.enableWikiLinks}
                onChange={(v) => settings.update({ enableWikiLinks: v })}
              />
            </SettingRow>
          )}
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableWordCountGoal')) && (
            <SettingRow label={ts('features.wordCountGoal.label')} description={ts('features.wordCountGoal.description')}>
              <ToggleSwitch
                checked={settings.enableWordCountGoal}
                onChange={(v) => settings.update({ enableWordCountGoal: v })}
              />
            </SettingRow>
          )}
        </>
      )}

      {shouldShowCategory('plugins') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.plugins')} />}
          <PluginsSection />
        </>
      )}

      {shouldShowCategory('folder-colors') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.folderColors')} />}
          {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorSubfolders')) && (
            <SettingRow label={ts('folderColors.colorSubfolders.label')} description={ts('folderColors.colorSubfolders.description')}>
              <ToggleSwitch
                checked={settings.folderColorSubfolders}
                onChange={(v) => settings.update({ folderColorSubfolders: v })}
              />
            </SettingRow>
          )}
          {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorFiles')) && (
            <SettingRow label={ts('folderColors.colorFiles.label')} description={ts('folderColors.colorFiles.description')}>
              <ToggleSwitch
                checked={settings.folderColorFiles}
                onChange={(v) => settings.update({ folderColorFiles: v })}
              />
            </SettingRow>
          )}

          {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorStyle')) && (
            <SettingRow label={ts('folderColors.folderStyle.label')} description={ts('folderColors.folderStyle.description')}>
              <select
                value={settings.folderColorStyle}
                onChange={(e) => settings.update({ folderColorStyle: e.target.value as FolderColorStyle })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                <option value="icon-only">{ts('folderColors.folderStyle.iconOnly')}</option>
                <option value="text">{ts('folderColors.folderStyle.text')}</option>
                <option value="background">{ts('folderColors.folderStyle.background')}</option>
                <option value="accent-bar">{ts('folderColors.folderStyle.accentBar')}</option>
                <option value="full">{ts('folderColors.folderStyle.full')}</option>
                <option value="dot">{ts('folderColors.folderStyle.dot')}</option>
                <option value="custom">{ts('folderColors.folderStyle.custom')}</option>
              </select>
            </SettingRow>
          )}

          {settings.folderColorStyle === 'custom' && (
            <>
              {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorIcon')) && (
                <SettingRow label={ts('folderColors.colorFolderIcon.label')} description={ts('folderColors.colorFolderIcon.description')}>
                  <ToggleSwitch
                    checked={settings.folderColorIcon}
                    onChange={(v) => settings.update({ folderColorIcon: v })}
                  />
                </SettingRow>
              )}
              {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorName')) && (
                <SettingRow label={ts('folderColors.colorFolderName.label')} description={ts('folderColors.colorFolderName.description')}>
                  <ToggleSwitch
                    checked={settings.folderColorName}
                    onChange={(v) => settings.update({ folderColorName: v })}
                  />
                </SettingRow>
              )}
              {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorBackground')) && (
                <SettingRow label={ts('folderColors.colorFolderBackground.label')} description={ts('folderColors.colorFolderBackground.description')}>
                  <ToggleSwitch
                    checked={settings.folderColorBackground}
                    onChange={(v) => settings.update({ folderColorBackground: v })}
                  />
                </SettingRow>
              )}
              {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorChevron')) && (
                <SettingRow label={ts('folderColors.colorChevron.label')} description={ts('folderColors.colorChevron.description')}>
                  <ToggleSwitch
                    checked={settings.folderColorChevron}
                    onChange={(v) => settings.update({ folderColorChevron: v })}
                  />
                </SettingRow>
              )}
            </>
          )}

          {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorFileStyle')) && (
            <SettingRow label={ts('folderColors.fileStyle.label')} description={ts('folderColors.fileStyle.description')}>
              <select
                value={settings.folderColorFileStyle}
                onChange={(e) => settings.update({ folderColorFileStyle: e.target.value as FolderColorStyle })}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{
                  backgroundColor: 'var(--ctp-surface0)',
                  color: 'var(--ctp-text)',
                  border: '1px solid var(--ctp-surface2)',
                }}
              >
                <option value="icon-only">{ts('folderColors.fileStyle.iconOnly')}</option>
                <option value="text">{ts('folderColors.fileStyle.text')}</option>
                <option value="background">{ts('folderColors.fileStyle.background')}</option>
                <option value="accent-bar">{ts('folderColors.fileStyle.accentBar')}</option>
                <option value="full">{ts('folderColors.fileStyle.full')}</option>
                <option value="dot">{ts('folderColors.fileStyle.dot')}</option>
                <option value="custom">{ts('folderColors.fileStyle.custom')}</option>
              </select>
            </SettingRow>
          )}

          {settings.folderColorFileStyle === 'custom' && (
            <>
              {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorFileIcon')) && (
                <SettingRow label={ts('folderColors.colorFileIcon.label')} description={ts('folderColors.colorFileIcon.description')}>
                  <ToggleSwitch
                    checked={settings.folderColorFileIcon}
                    onChange={(v) => settings.update({ folderColorFileIcon: v })}
                  />
                </SettingRow>
              )}
              {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorFileName')) && (
                <SettingRow label={ts('folderColors.colorFileName.label')} description={ts('folderColors.colorFileName.description')}>
                  <ToggleSwitch
                    checked={settings.folderColorFileName}
                    onChange={(v) => settings.update({ folderColorFileName: v })}
                  />
                </SettingRow>
              )}
              {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorFileBackground')) && (
                <SettingRow label={ts('folderColors.colorFileBackground.label')} description={ts('folderColors.colorFileBackground.description')}>
                  <ToggleSwitch
                    checked={settings.folderColorFileBackground}
                    onChange={(v) => settings.update({ folderColorFileBackground: v })}
                  />
                </SettingRow>
              )}
            </>
          )}

          {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorBold')) && (
            <SettingRow label={ts('folderColors.boldFolderNames.label')} description={ts('folderColors.boldFolderNames.description')}>
              <ToggleSwitch
                checked={settings.folderColorBold}
                onChange={(v) => settings.update({ folderColorBold: v })}
              />
            </SettingRow>
          )}

          {(!visibleFolderColorsIds || visibleFolderColorsIds.has('folderColorOpacity')) && (
            <SettingRow label={ts('folderColors.colorIntensity.label')} description={ts('folderColors.colorIntensity.description')}>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.05}
                  max={0.5}
                  step={0.05}
                  value={settings.folderColorOpacity}
                  onChange={(e) => settings.update({ folderColorOpacity: Number(e.target.value) })}
                  className="flex-1 accent-[var(--ctp-accent)]"
                  style={{ maxWidth: 120 }}
                />
                <span className="text-xs w-8 text-right" style={{ color: 'var(--ctp-subtext1)' }}>
                  {Math.round(settings.folderColorOpacity * 100)}%
                </span>
              </div>
            </SettingRow>
          )}
          <FeatureWiki featureId="folder-colors" />
        </>
      )}

      {shouldShowCategory('wikilinks-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.wikiLinks')} />}
          <WikiLinksOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('livepreview-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.livePreview')} />}
          <LivePreviewOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('tags-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.tags')} />}
          <TagsOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('graph-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.graphView')} />}
          <GraphOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('backlinks-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.backlinks')} />}
          <BacklinksOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('outline-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.outline')} />}
          <OutlineOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('variables-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.variables')} />}
          <VariablesOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('dailynotes-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.dailyNotes')} />}
          <DailyNotesOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('codefolding-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.codeFolding')} />}
          <CodeFoldingOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('highlight-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.highlights')} />}
          <HighlightOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('properties-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.properties')} />}
          <PropertiesOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('statusbar-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.statusBar')} />}
          <StatusBarOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('autosave-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.autosave')} />}
          <AutoSaveOptionsPage settings={settings} intervalValue={intervalValue} setIntervalValue={setIntervalValue} commitInterval={commitInterval} />
        </>
      )}

      {shouldShowCategory('spellcheck-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.spellcheck')} />}
          <SpellcheckOptionsPage />
        </>
      )}

      {shouldShowCategory('templates-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.templates')} />}
          <TemplatesOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('search-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.search')} />}
          <SearchOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('focusmode-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.focusMode')} />}
          <FocusModeOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('wordcountgoal-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.wordCountGoal')} />}
          <WordCountGoalOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('canvas-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.canvas')} />}
          <CanvasOptionsPage />
        </>
      )}

      {shouldShowCategory('bookmarks-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.bookmarks')} />}
          <BookmarksOptionsPage />
        </>
      )}

      {shouldShowCategory('typewriter-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.typewriterMode')} />}
          <TypewriterOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('indentguides-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.indentGuides')} />}
          <IndentGuidesOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('imagepreview-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.imagePreview')} />}
          <ImagePreviewOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('mediaviewer-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.mediaViewer')} />}
          <MediaViewerOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('toc-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.tableOfContents')} />}
          <TocOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('query-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.queryPreview')} />}
          <QueryOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('sync-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.sync')} />}
          <SyncOptionsPage settings={settings} />
        </>
      )}

      {shouldShowCategory('shortcuts') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.shortcuts')} />}
          {isSearching ? (
            showShortcuts!.map(({ id, label, defaultShortcut, customShortcut }) => {
              const isEditing = editingId === id;
              const displayShortcut = customShortcut ?? defaultShortcut;
              const isCustomized = customShortcut !== undefined;
              return (
                <div key={id} className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{label}</span>
                    {isCustomized && (
                      <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
                        {ts('shortcuts.default', { shortcut: formatShortcutDisplay(defaultShortcut) })}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isEditing ? (
                      <KeyCaptureInput capturedKey={capturedKey} onKeyCapture={handleKeyCapture} onSave={() => saveBinding(id)} onCancel={cancelEditing} />
                    ) : (
                      <>
                        <button onClick={() => startEditing(id)} className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors hover:bg-[var(--ctp-surface2)]" style={{ backgroundColor: 'var(--ctp-surface1)', color: isCustomized ? 'var(--ctp-accent)' : 'var(--ctp-text)', border: isCustomized ? '1px solid var(--ctp-accent)' : '1px solid transparent', fontFamily: 'monospace' }} title={ts('shortcuts.clickToRebind')}>{formatShortcutDisplay(displayShortcut)}</button>
                        {isCustomized && (
                          <button onClick={() => resetBinding(id)} className="flex items-center justify-center rounded transition-colors hover:bg-[var(--ctp-surface1)]" style={{ width: 20, height: 20, color: 'var(--ctp-overlay1)' }} title={ts('shortcuts.resetToDefault')}><X size={11} /></button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            SHORTCUT_GROUPS.map((group) => {
              const groupItems = group.ids.map((gid) => shortcutCommands.find((sc) => sc.id === gid)).filter(Boolean) as typeof shortcutCommands;
              return (
                <div key={group.labelKey}>
                  <SubHeader label={ts(group.labelKey)} />
                  <div className="flex flex-col gap-5">
                    {groupItems.map(({ id, label, defaultShortcut, customShortcut }) => {
                      const isEditing = editingId === id;
                      const displayShortcut = customShortcut ?? defaultShortcut;
                      const isCustomized = customShortcut !== undefined;
                      return (
                        <div key={id} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{label}</span>
                            {isCustomized && (
                              <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
                                {ts('shortcuts.default', { shortcut: formatShortcutDisplay(defaultShortcut) })}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            {isEditing ? (
                              <KeyCaptureInput capturedKey={capturedKey} onKeyCapture={handleKeyCapture} onSave={() => saveBinding(id)} onCancel={cancelEditing} />
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditing(id)}
                                  className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors hover:bg-[var(--ctp-surface2)]"
                                  style={{
                                    backgroundColor: 'var(--ctp-surface1)',
                                    color: isCustomized ? 'var(--ctp-accent)' : 'var(--ctp-text)',
                                    border: isCustomized ? '1px solid var(--ctp-accent)' : '1px solid transparent',
                                    fontFamily: 'monospace',
                                  }}
                                  title={ts('shortcuts.clickToRebind')}
                                >
                                  {formatShortcutDisplay(displayShortcut)}
                                </button>
                                {isCustomized && (
                                  <button
                                    onClick={() => resetBinding(id)}
                                    className="flex items-center justify-center rounded transition-colors hover:bg-[var(--ctp-surface1)]"
                                    style={{ width: 20, height: 20, color: 'var(--ctp-overlay1)' }}
                                    title={ts('shortcuts.resetToDefault')}
                                  >
                                    <X size={11} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

interface KeyCaptureInputProps {
  capturedKey: string;
  onKeyCapture: (e: KeyboardEvent) => void;
  onSave: () => void;
  onCancel: () => void;
}

function KeyCaptureInput({ capturedKey, onKeyCapture, onSave, onCancel }: KeyCaptureInputProps) {
  const { t: ts } = useTranslation('settings');
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.addEventListener('keydown', onKeyCapture);
    return () => el.removeEventListener('keydown', onKeyCapture);
  }, [onKeyCapture]);

  return (
    <div className="flex items-center gap-1">
      <div
        ref={inputRef}
        tabIndex={0}
        className="rounded px-2 py-0.5 text-xs outline-none"
        style={{
          backgroundColor: 'var(--ctp-surface0)',
          border: '1px solid var(--ctp-accent)',
          color: capturedKey ? 'var(--ctp-text)' : 'var(--ctp-overlay0)',
          fontFamily: 'monospace',
          minWidth: 80,
          textAlign: 'center',
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        {capturedKey || ts('shortcuts.pressKeys')}
      </div>
      {capturedKey && (
        <button
          onClick={onSave}
          className="rounded px-1.5 py-0.5 text-xs transition-colors"
          style={{ backgroundColor: 'var(--ctp-accent)', color: 'var(--ctp-base)' }}
        >
          {ts('shortcuts.save')}
        </button>
      )}
      <button
        onClick={onCancel}
        className="flex items-center justify-center rounded transition-colors hover:bg-[var(--ctp-surface1)]"
        style={{ width: 20, height: 20, color: 'var(--ctp-overlay1)' }}
        title={ts('shortcuts.cancel')}
      >
        <X size={11} />
      </button>
    </div>
  );
}

function CommunityThemesSection() {
  const { t: ts } = useTranslation('settings');
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
      <button
        className="flex items-center justify-between w-full px-0 py-2.5 text-left transition-colors"
        style={{ color: 'var(--ctp-subtext0)', background: 'none', border: 'none', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ctp-subtext0)' }}>{ts('appearance.communityThemes')}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="pb-3">
          <ThemeMarketplace />
        </div>
      )}
    </div>
  );
}

function ThemeMarketplace() {
  const { t: ts } = useTranslation('settings');
  const [themes, setThemes] = useState<import('../lib/plugin-registry').RegistryTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installError, setInstallError] = useState<Record<string, string>>({});
  const [installSuccess, setInstallSuccess] = useState<Record<string, boolean>>({});
  const [newRegistryUrl, setNewRegistryUrl] = useState('');
  const themeRegistries = useSettingsStore((s) => s.themeRegistries);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  useEffect(() => {
    setLoading(true);
    import('../lib/plugin-registry').then(({ fetchThemeRegistry }) =>
      fetchThemeRegistry(themeRegistries)
    ).then(setThemes).catch(() => setThemes([])).finally(() => setLoading(false));
  }, [themeRegistries]);

  const filtered = themes.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleInstall = async (theme: import('../lib/plugin-registry').RegistryTheme) => {
    if (!vaultPath) return;
    setInstalling(theme.id);
    setInstallError((prev) => ({ ...prev, [theme.id]: '' }));
    setInstallSuccess((prev) => ({ ...prev, [theme.id]: false }));
    try {
      const { installTheme } = await import('../lib/plugin-registry');
      await installTheme(vaultPath, theme);
      setInstallSuccess((prev) => ({ ...prev, [theme.id]: true }));
    } catch (err) {
      setInstallError((prev) => ({ ...prev, [theme.id]: String(err) }));
    } finally {
      setInstalling(null);
    }
  };

  const handleAddRegistry = () => {
    const url = newRegistryUrl.trim();
    if (!url || themeRegistries.includes(url)) return;
    useSettingsStore.getState().update({ themeRegistries: [...themeRegistries, url] });
    setNewRegistryUrl('');
  };

  const handleRemoveRegistry = (url: string) => {
    useSettingsStore.getState().update({ themeRegistries: themeRegistries.filter((r) => r !== url) });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ctp-overlay0)' }} />
        <input
          type="text"
          placeholder={ts('appearance.themeMarketplace.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface1)' }}
        />
      </div>

      {/* Theme list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{ts('appearance.themeMarketplace.loadingRegistry')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {themes.length === 0 ? ts('appearance.themeMarketplace.noThemesFound') : ts('appearance.themeMarketplace.noThemesMatch')}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((theme) => (
            <div
              key={theme.id}
              className="flex flex-col gap-2 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: 'var(--ctp-surface0)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--ctp-text)' }}>{theme.name}</span>
                    <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>v{theme.version}</span>
                    <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{ts('appearance.themeMarketplace.by', { author: theme.author })}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: 'var(--ctp-surface1)',
                        color: theme.dark ? 'var(--ctp-blue)' : 'var(--ctp-yellow)',
                        border: `1px solid ${theme.dark ? 'var(--ctp-blue)' : 'var(--ctp-yellow)'}`,
                      }}
                    >
                      {theme.dark ? ts('appearance.themeMarketplace.darkLabel') : ts('appearance.themeMarketplace.lightLabel')}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--ctp-subtext0)' }}>{theme.description}</p>
                  {/* Color swatches */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: theme.previewColors.base, borderColor: 'var(--ctp-surface2)' }} title={ts('appearance.themeMarketplace.base')} />
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: theme.previewColors.text, borderColor: 'var(--ctp-surface2)' }} title={ts('appearance.themeMarketplace.text')} />
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: theme.previewColors.accent, borderColor: 'var(--ctp-surface2)' }} title={ts('appearance.themeMarketplace.accent')} />
                  </div>
                </div>
                <button
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: installSuccess[theme.id] ? 'var(--ctp-green)' : 'var(--ctp-blue)', color: 'var(--ctp-base)' }}
                  onClick={() => handleInstall(theme)}
                  disabled={installing === theme.id || installSuccess[theme.id]}
                >
                  {installing === theme.id ? ts('appearance.themeMarketplace.installing') : installSuccess[theme.id] ? ts('appearance.themeMarketplace.installed') : ts('appearance.themeMarketplace.install')}
                </button>
              </div>
              {installError[theme.id] && (
                <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(243,139,168,0.15)', color: 'var(--ctp-red)' }}>
                  {installError[theme.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Registry management */}
      <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--ctp-subtext0)' }}>{ts('appearance.themeMarketplace.registries')}</span>
        {themeRegistries.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{ts('appearance.themeMarketplace.noRegistries')}</span>
        )}
        {themeRegistries.map((url) => (
          <div key={url} className="flex items-center justify-between gap-2 rounded px-2 py-1.5" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
            <span className="text-xs truncate" style={{ color: 'var(--ctp-subtext0)' }}>{url}</span>
            <button
              className="shrink-0 p-1 rounded transition-colors hover:brightness-110"
              style={{ color: 'var(--ctp-red)' }}
              onClick={() => handleRemoveRegistry(url)}
              title={ts('appearance.themeMarketplace.removeRegistry')}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            placeholder={ts('appearance.themeMarketplace.registryPlaceholder')}
            value={newRegistryUrl}
            onChange={(e) => setNewRegistryUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddRegistry(); }}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
            style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface1)' }}
          />
          <button
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-text)' }}
            onClick={handleAddRegistry}
            disabled={!newRegistryUrl.trim()}
          >
            {ts('appearance.themeMarketplace.add')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PluginMarketplace() {
  const { t: tp } = useTranslation('plugins');
  const { t } = useTranslation('common');
  const [registry, setRegistry] = useState<import('../lib/plugin-registry').RegistryPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installError, setInstallError] = useState<Record<string, string>>({});
  const [installSuccess, setInstallSuccess] = useState<Record<string, boolean>>({});
  const [newRegistryUrl, setNewRegistryUrl] = useState('');
  const pluginRegistries = useSettingsStore((s) => s.pluginRegistries);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  useEffect(() => {
    setLoading(true);
    import('../lib/plugin-registry').then(({ fetchPluginRegistry }) =>
      fetchPluginRegistry(pluginRegistries)
    ).then(setRegistry).catch(() => setRegistry([])).finally(() => setLoading(false));
  }, [pluginRegistries]);

  const filtered = registry.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleInstall = async (plugin: import('../lib/plugin-registry').RegistryPlugin) => {
    if (!vaultPath) return;
    setInstalling(plugin.id);
    setInstallError((prev) => ({ ...prev, [plugin.id]: '' }));
    setInstallSuccess((prev) => ({ ...prev, [plugin.id]: false }));
    try {
      const { installPlugin } = await import('../lib/plugin-registry');
      await installPlugin(vaultPath, plugin);
      await usePluginStore.getState().discoverPlugins(vaultPath);
      setInstallSuccess((prev) => ({ ...prev, [plugin.id]: true }));
    } catch (err) {
      setInstallError((prev) => ({ ...prev, [plugin.id]: String(err) }));
    } finally {
      setInstalling(null);
    }
  };

  const handleAddRegistry = () => {
    const url = newRegistryUrl.trim();
    if (!url || pluginRegistries.includes(url)) return;
    useSettingsStore.getState().update({ pluginRegistries: [...pluginRegistries, url] });
    setNewRegistryUrl('');
  };

  const handleRemoveRegistry = (url: string) => {
    useSettingsStore.getState().update({ pluginRegistries: pluginRegistries.filter((r) => r !== url) });
  };

  const PERMISSION_COLORS: Record<string, string> = {
    'read-vault': 'var(--ctp-blue)',
    'write-vault': 'var(--ctp-peach)',
    'delete-vault': 'var(--ctp-red)',
    'network': 'var(--ctp-mauve)',
    'shell': 'var(--ctp-red)',
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ctp-overlay0)' }} />
        <input
          type="text"
          placeholder={tp('marketplace.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface1)' }}
        />
      </div>

      {/* Plugin list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{tp('marketplace.loadingRegistry')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {registry.length === 0 ? tp('marketplace.noPluginsFound') : tp('marketplace.noPluginsMatch')}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((plugin) => (
            <div
              key={plugin.id}
              className="flex flex-col gap-2 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: 'var(--ctp-surface0)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--ctp-text)' }}>{plugin.name}</span>
                    <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>v{plugin.version}</span>
                    <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{tp('marketplace.by', { author: plugin.author })}</span>
                  </div>
                  <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--ctp-subtext0)' }}>{plugin.description}</p>
                  {plugin.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {plugin.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: 'var(--ctp-surface1)', color: PERMISSION_COLORS[perm] ?? 'var(--ctp-subtext0)', border: `1px solid ${PERMISSION_COLORS[perm] ?? 'var(--ctp-overlay0)'}` }}
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: installSuccess[plugin.id] ? 'var(--ctp-green)' : 'var(--ctp-blue)', color: 'var(--ctp-base)' }}
                  onClick={() => handleInstall(plugin)}
                  disabled={installing === plugin.id || installSuccess[plugin.id]}
                >
                  {installing === plugin.id ? tp('marketplace.installing') : installSuccess[plugin.id] ? tp('marketplace.installed') : t('install')}
                </button>
              </div>
              {installError[plugin.id] && (
                <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(243,139,168,0.15)', color: 'var(--ctp-red)' }}>
                  {installError[plugin.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Registry management */}
      <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--ctp-surface1)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--ctp-subtext0)' }}>{tp('marketplace.registries')}</span>
        {pluginRegistries.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{tp('marketplace.noRegistries')}</span>
        )}
        {pluginRegistries.map((url) => (
          <div key={url} className="flex items-center justify-between gap-2 rounded px-2 py-1.5" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
            <span className="text-xs truncate" style={{ color: 'var(--ctp-subtext0)' }}>{url}</span>
            <button
              className="shrink-0 p-1 rounded transition-colors hover:brightness-110"
              style={{ color: 'var(--ctp-red)' }}
              onClick={() => handleRemoveRegistry(url)}
              title={tp('marketplace.removeRegistry')}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            placeholder={tp('marketplace.registryPlaceholder')}
            value={newRegistryUrl}
            onChange={(e) => setNewRegistryUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddRegistry(); }}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
            style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface1)' }}
          />
          <button
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-text)' }}
            onClick={handleAddRegistry}
            disabled={!newRegistryUrl.trim()}
          >
            {t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PluginsSection() {
  const { t: tp } = useTranslation('plugins');
  const pluginsEnabled = useSettingsStore((s) => s.pluginsEnabled);
  const plugins = usePluginStore((s) => s.plugins);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const entries = Array.from(plugins.values());
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [pluginView, setPluginView] = useState<'installed' | 'browse'>('installed');

  const handleEnablePlugins = async () => {
    useSettingsStore.getState().update({ pluginsEnabled: true });
    if (vaultPath) {
      usePluginStore.getState().discoverPlugins(vaultPath);
    }
  };

  const handleDisablePlugins = async () => {
    await usePluginStore.getState().unloadAll();
    useSettingsStore.getState().update({ pluginsEnabled: false, enabledPlugins: [] });
  };

  if (!pluginsEnabled) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-full"
          style={{ backgroundColor: 'var(--ctp-surface1)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ctp-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold" style={{ color: 'var(--ctp-text)' }}>
            {tp('section.thirdPartyPlugins')}
          </span>
          <span className="text-xs leading-relaxed" style={{ color: 'var(--ctp-subtext0)' }}>
            {tp('section.thirdPartyWarning')}
          </span>
        </div>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:brightness-110"
          style={{ backgroundColor: 'var(--ctp-accent)', color: 'var(--ctp-base)' }}
          onClick={handleEnablePlugins}
        >
          {tp('section.turnOnPlugins')}
        </button>
      </div>
    );
  }

  const handleOpenPluginFolder = async () => {
    if (!vaultPath) return;
    const pluginDir = `${vaultPath}/.cascade/plugins`.replace(/\//g, '\\');
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(pluginDir);
    } catch (e) {
      console.warn('Failed to open plugins folder:', e);
    }
  };

  const viewToggle = (
    <div className="flex rounded-lg p-0.5 mb-3" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
      {(['installed', 'browse'] as const).map((view) => (
        <button
          key={view}
          className="flex-1 px-3 py-1 rounded text-xs font-medium transition-all capitalize"
          style={{
            backgroundColor: pluginView === view ? 'var(--ctp-surface2)' : 'transparent',
            color: pluginView === view ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
          }}
          onClick={() => { setSelectedPlugin(null); setPluginView(view); }}
        >
          {view === 'installed' ? tp('section.tabInstalled') : tp('section.tabBrowse')}
        </button>
      ))}
    </div>
  );

  const pluginsHeader = (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
            {tp('section.thirdPartyEnabled')}
          </span>
          <button
            className="p-1.5 rounded transition-colors cursor-pointer"
            style={{ color: 'var(--ctp-subtext0)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--ctp-surface1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={handleOpenPluginFolder}
            title={tp('section.openPluginsFolder')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
        <ToggleSwitch checked={pluginsEnabled} onChange={handleDisablePlugins} />
      </div>
      {viewToggle}
    </div>
  );

  const handleToggle = async (entry: PluginEntry) => {
    const store = usePluginStore.getState();
    if (entry.enabled) {
      await store.disablePlugin(entry.manifest.id);
    } else {
      await store.enablePlugin(entry.manifest.id);
      if (vaultPath) {
        await store.loadPlugin(entry.manifest.id, vaultPath);
      }
    }
  };

  if (pluginView === 'browse') {
    return (
      <div className="flex flex-col gap-0">
        {pluginsHeader}
        <PluginMarketplace />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div>
        {pluginsHeader}
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {tp('section.noPluginsInstalled')}
          </span>
        </div>
      </div>
    );
  }

  const selected = selectedPlugin ? plugins.get(selectedPlugin) : null;
  if (selected) {
    return <PluginDetail entry={selected} onBack={() => setSelectedPlugin(null)} onToggle={() => handleToggle(selected)} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {pluginsHeader}
      {entries.map((entry) => (
        <div
          key={entry.manifest.id}
          role="button"
          tabIndex={0}
          className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left transition-colors hover:brightness-110 cursor-pointer"
          style={{ backgroundColor: 'var(--ctp-surface0)' }}
          onClick={() => setSelectedPlugin(entry.manifest.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPlugin(entry.manifest.id); } }}
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>
                {entry.manifest.name}
              </span>
              <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
                v{entry.manifest.version}
              </span>
              {entry.loaded && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--ctp-green)', color: 'var(--ctp-base)' }}>
                  {tp('section.active')}
                </span>
              )}
            </div>
            {entry.error && (
              <div
                className="flex items-center gap-1.5 mt-1 px-2 py-1 rounded text-xs"
                style={{ backgroundColor: 'rgba(243, 139, 168, 0.15)', color: 'var(--ctp-red)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="truncate">{entry.error}</span>
              </div>
            )}
          </div>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <ToggleSwitch checked={entry.enabled} onChange={() => handleToggle(entry)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PluginDetail({ entry, onBack, onToggle }: { entry: PluginEntry; onBack: () => void; onToggle: () => void }) {
  const { t: tp } = useTranslation('plugins');
  const { t } = useTranslation('common');
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [readme, setReadme] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(true);

  useEffect(() => {
    if (!vaultPath) { setReadmeLoading(false); return; }
    const id = entry.manifest.id;
    const tryFiles = ['README.md', 'readme.md', 'Readme.md', 'README.txt', 'readme.txt'];
    let cancelled = false;

    (async () => {
      for (const file of tryFiles) {
        try {
          const content = await import('../lib/tauri-commands').then((cmd) =>
            cmd.readFile(vaultPath, `.cascade/plugins/${id}/${file}`)
          );
          if (!cancelled) { setReadme(content); setReadmeLoading(false); }
          return;
        } catch {
          // Try next file
        }
      }
      if (!cancelled) { setReadme(null); setReadmeLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [vaultPath, entry.manifest.id]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--ctp-surface1)]"
          style={{ color: 'var(--ctp-accent)' }}
        >
          {tp('detail.back')}
        </button>
      </div>

      {/* Plugin info card */}
      <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 40, height: 40, backgroundColor: 'var(--ctp-surface1)' }}>
              <Puzzle size={20} style={{ color: 'var(--ctp-accent)' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold" style={{ color: 'var(--ctp-text)' }}>
                  {entry.manifest.name}
                </span>
                <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
                  v{entry.manifest.version}
                </span>
              </div>
              <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
                {entry.manifest.id}
              </span>
            </div>
          </div>
          <ToggleSwitch checked={entry.enabled} onChange={onToggle} />
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay1)' }}>{tp('detail.statusLabel')}</span>
          {entry.loaded ? (
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-green)' }}>{tp('detail.statusActive')}</span>
          ) : entry.enabled ? (
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-yellow)' }}>{tp('detail.statusEnabledNotLoaded')}</span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{tp('detail.statusDisabled')}</span>
          )}
        </div>

        {entry.error && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-2 text-xs"
            style={{ backgroundColor: 'rgba(243, 139, 168, 0.12)', border: '1px solid rgba(243, 139, 168, 0.25)', color: 'var(--ctp-red)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="break-all">{entry.error}</span>
          </div>
        )}

        {/* Permissions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--ctp-overlay1)' }}>{tp('detail.permissionsLabel')}</span>
          {entry.manifest.permissions.map((perm) => (
            <span
              key={perm}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-subtext0)' }}
            >
              {perm}
            </span>
          ))}
        </div>
      </div>

      {/* README */}
      <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--ctp-surface0)' }}>
        <span className="text-xs font-medium block mb-2" style={{ color: 'var(--ctp-overlay1)' }}>
          {tp('detail.readmeSection')}
        </span>
        {readmeLoading ? (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('loading')}</span>
        ) : readme ? (
          <RenderedMarkdown content={readme} />
        ) : (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {tp('detail.noReadme')}
          </span>
        )}
      </div>
    </div>
  );
}

type OptionsPageProps = { settings: Settings & { update: (partial: Partial<Settings>) => void } };

function WikiLinksOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('wikiLinksOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('wikiLinksOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('wikiLinksOptions.openInNewTab.label')} description={ts('wikiLinksOptions.openInNewTab.description')}>
        <ToggleSwitch
          checked={settings.wikiLinksOpenInNewTab}
          onChange={(v) => settings.update({ wikiLinksOpenInNewTab: v })}
        />
      </SettingRow>

      <SettingRow label={ts('wikiLinksOptions.showFullPath.label')} description={ts('wikiLinksOptions.showFullPath.description')}>
        <ToggleSwitch
          checked={settings.wikiLinksShowFullPath}
          onChange={(v) => settings.update({ wikiLinksShowFullPath: v })}
        />
      </SettingRow>

      <SettingRow label={ts('wikiLinksOptions.createOnFollow.label')} description={ts('wikiLinksOptions.createOnFollow.description')}>
        <ToggleSwitch
          checked={settings.wikiLinksCreateOnFollow}
          onChange={(v) => settings.update({ wikiLinksCreateOnFollow: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="wikilinks-options" />
    </div>
  );
}

function LivePreviewOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('livePreviewOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('livePreviewOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('livePreviewOptions.headings.label')} description={ts('livePreviewOptions.headings.description')}>
        <ToggleSwitch
          checked={settings.livePreviewHeadings}
          onChange={(v) => settings.update({ livePreviewHeadings: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.bold.label')} description={ts('livePreviewOptions.bold.description')}>
        <ToggleSwitch
          checked={settings.livePreviewBold}
          onChange={(v) => settings.update({ livePreviewBold: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.italic.label')} description={ts('livePreviewOptions.italic.description')}>
        <ToggleSwitch
          checked={settings.livePreviewItalic}
          onChange={(v) => settings.update({ livePreviewItalic: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.links.label')} description={ts('livePreviewOptions.links.description')}>
        <ToggleSwitch
          checked={settings.livePreviewLinks}
          onChange={(v) => settings.update({ livePreviewLinks: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.images.label')} description={ts('livePreviewOptions.images.description')}>
        <ToggleSwitch
          checked={settings.livePreviewImages}
          onChange={(v) => settings.update({ livePreviewImages: v })}
        />
      </SettingRow>

      <SettingRow label={ts('livePreviewOptions.codeBlocks.label')} description={ts('livePreviewOptions.codeBlocks.description')}>
        <ToggleSwitch
          checked={settings.livePreviewCodeBlocks}
          onChange={(v) => settings.update({ livePreviewCodeBlocks: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="livepreview-options" />
    </div>
  );
}

function TagsOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('tagsOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('tagsOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('tagsOptions.autoComplete.label')} description={ts('tagsOptions.autoComplete.description')}>
        <ToggleSwitch
          checked={settings.tagsAutoComplete}
          onChange={(v) => settings.update({ tagsAutoComplete: v })}
        />
      </SettingRow>

      <SettingRow label={ts('tagsOptions.nestedTags.label')} description={ts('tagsOptions.nestedTags.description')}>
        <ToggleSwitch
          checked={settings.tagsNestedSupport}
          onChange={(v) => settings.update({ tagsNestedSupport: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="tags-options" />
    </div>
  );
}

function GraphOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('graphOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('graphOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('graphOptions.nodeSize.label')} description={ts('graphOptions.nodeSize.description')}>
        <input
          type="number"
          min={1}
          max={20}
          value={settings.graphNodeSize}
          onChange={(e) => settings.update({ graphNodeSize: Math.max(1, Math.min(20, Number(e.target.value) || 6)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('graphOptions.linkDistance.label')} description={ts('graphOptions.linkDistance.description')}>
        <input
          type="number"
          min={20}
          max={300}
          value={settings.graphLinkDistance}
          onChange={(e) => settings.update({ graphLinkDistance: Math.max(20, Math.min(300, Number(e.target.value) || 80)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('graphOptions.showOrphans.label')} description={ts('graphOptions.showOrphans.description')}>
        <ToggleSwitch
          checked={settings.graphShowOrphans}
          onChange={(v) => settings.update({ graphShowOrphans: v })}
        />
      </SettingRow>

      <SettingRow label={ts('graphOptions.maxNodes.label')} description={ts('graphOptions.maxNodes.description')}>
        <input
          type="number"
          min={50}
          max={2000}
          step={50}
          value={settings.graphMaxNodes}
          onChange={(e) => settings.update({ graphMaxNodes: Math.max(50, Math.min(2000, Number(e.target.value) || 500)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>
      <FeatureWiki featureId="graph-options" />
    </div>
  );
}

function BacklinksOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('backlinksOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('backlinksOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('backlinksOptions.contextLines.label')} description={ts('backlinksOptions.contextLines.description')}>
        <input
          type="number"
          min={0}
          max={5}
          value={settings.backlinksContextLines}
          onChange={(e) => settings.update({ backlinksContextLines: Math.max(0, Math.min(5, Number(e.target.value) || 2)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('backlinksOptions.groupByFolder.label')} description={ts('backlinksOptions.groupByFolder.description')}>
        <ToggleSwitch
          checked={settings.backlinksGroupByFolder}
          onChange={(v) => settings.update({ backlinksGroupByFolder: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="backlinks-options" />
    </div>
  );
}

function OutlineOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('outlineOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('outlineOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('outlineOptions.minHeadingLevel.label')} description={ts('outlineOptions.minHeadingLevel.description')}>
        <select
          value={settings.outlineMinLevel}
          onChange={(e) => settings.update({ outlineMinLevel: Number(e.target.value) })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={inputStyle}
        >
          <option value={1}>{ts('outlineOptions.minHeadingLevel.h1')}</option>
          <option value={2}>{ts('outlineOptions.minHeadingLevel.h2')}</option>
          <option value={3}>{ts('outlineOptions.minHeadingLevel.h3')}</option>
          <option value={4}>{ts('outlineOptions.minHeadingLevel.h4')}</option>
          <option value={5}>{ts('outlineOptions.minHeadingLevel.h5')}</option>
          <option value={6}>{ts('outlineOptions.minHeadingLevel.h6')}</option>
        </select>
      </SettingRow>

      <SettingRow label={ts('outlineOptions.autoExpand.label')} description={ts('outlineOptions.autoExpand.description')}>
        <ToggleSwitch
          checked={settings.outlineAutoExpand}
          onChange={(v) => settings.update({ outlineAutoExpand: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="outline-options" />
    </div>
  );
}

function VariablesOptionsPage({ settings }: { settings: Settings & { update: (partial: Partial<Settings>) => void } }) {
  const { t: ts } = useTranslation('settings');
  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('variablesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('variablesOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('variablesOptions.highlightVariables.label')} description={ts('variablesOptions.highlightVariables.description')}>
        <ToggleSwitch
          checked={settings.variablesHighlight}
          onChange={(v) => settings.update({ variablesHighlight: v })}
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.openDelimiter.label')} description={ts('variablesOptions.openDelimiter.description')}>
        <input
          type="text"
          value={settings.variablesOpenDelimiter}
          onChange={(e) => settings.update({ variablesOpenDelimiter: e.target.value || '<' })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
          placeholder="<"
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.closeDelimiter.label')} description={ts('variablesOptions.closeDelimiter.description')}>
        <input
          type="text"
          value={settings.variablesCloseDelimiter}
          onChange={(e) => settings.update({ variablesCloseDelimiter: e.target.value || '>' })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
          placeholder=">"
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.defaultSeparator.label')} description={ts('variablesOptions.defaultSeparator.description')}>
        <input
          type="text"
          value={settings.variablesDefaultSeparator}
          onChange={(e) => settings.update({ variablesDefaultSeparator: e.target.value || ':' })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
          placeholder=":"
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.missingValueText.label')} description={ts('variablesOptions.missingValueText.description')}>
        <input
          type="text"
          value={settings.variablesMissingText}
          onChange={(e) => settings.update({ variablesMissingText: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none w-24"
          style={inputStyle}
          placeholder="[MISSING]"
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.supportNesting.label')} description={ts('variablesOptions.supportNesting.description')}>
        <ToggleSwitch
          checked={settings.variablesSupportNesting}
          onChange={(v) => settings.update({ variablesSupportNesting: v })}
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.caseInsensitive.label')} description={ts('variablesOptions.caseInsensitive.description')}>
        <ToggleSwitch
          checked={settings.variablesCaseInsensitive}
          onChange={(v) => settings.update({ variablesCaseInsensitive: v })}
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.arraySeparator.label')} description={ts('variablesOptions.arraySeparator.description')}>
        <input
          type="text"
          value={settings.variablesArrayJoinSeparator}
          onChange={(e) => settings.update({ variablesArrayJoinSeparator: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
          placeholder=", "
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.preserveOnMissing.label')} description={ts('variablesOptions.preserveOnMissing.description')}>
        <ToggleSwitch
          checked={settings.variablesPreserveOnMissing}
          onChange={(v) => settings.update({ variablesPreserveOnMissing: v })}
        />
      </SettingRow>

      <SettingRow label={ts('variablesOptions.sidebarButtonAction.label')} description={ts('variablesOptions.sidebarButtonAction.description')}>
        <select
          value={settings.variablesSidebarAction}
          onChange={(e) => settings.update({ variablesSidebarAction: e.target.value as 'list' | 'menu' })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={inputStyle}
        >
          <option value="list">{ts('variablesOptions.sidebarButtonAction.openList')}</option>
          <option value="menu">{ts('variablesOptions.sidebarButtonAction.showMenu')}</option>
        </select>
      </SettingRow>
      <FeatureWiki featureId="variables-options" />
    </div>
  );
}

/** Slider that shows a live preview but only commits the value on mouse/pointer release */
function UiFontSizeSlider({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={11}
        max={18}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={() => onCommit(draft)}
        onTouchEnd={() => onCommit(draft)}
        onKeyUp={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') onCommit(draft); }}
        className="accent-[var(--ctp-accent)]"
        style={{ width: 120 }}
      />
      <span className="text-xs text-right" style={{ color: 'var(--ctp-subtext1)', width: 32 }}>
        {draft}px
      </span>
    </div>
  );
}

function SettingRow({ label, description, children, onReset }: { label: string; description: string; children: React.ReactNode; onReset?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm" style={{ color: 'var(--ctp-text)' }}>{label}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{description}</span>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {children}
        {onReset && (
          <button
            onClick={onReset}
            className="p-0.5 rounded transition-colors hover:bg-[var(--ctp-surface1)]"
            style={{ color: 'var(--ctp-overlay0)' }}
            title={i18n.t('settings:resetToDefault')}
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

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

function AccentColorPicker({ value, onChange }: { value: AccentColor; onChange: (v: AccentColor) => void }) {
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

function DailyNotesOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('dailyNotesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('dailyNotesOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('dailyNotesOptions.notesFolder.label')} description={ts('dailyNotesOptions.notesFolder.description')}>
        <input
          type="text"
          value={settings.dailyNotesFolder}
          onChange={(e) => settings.update({ dailyNotesFolder: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none w-32"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
          placeholder={ts('dailyNotesOptions.notesFolder.placeholder')}
        />
      </SettingRow>

      <SettingRow label={ts('dailyNotesOptions.dateFormat.label')} description={ts('dailyNotesOptions.dateFormat.description')}>
        <select
          value={settings.dailyNotesFormat}
          onChange={(e) => settings.update({ dailyNotesFormat: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          <option value="DD-MM-YYYY">DD-MM-YYYY</option>
          <option value="MM-DD-YYYY">MM-DD-YYYY</option>
          <option value="YYYYMMDD">YYYYMMDD</option>
        </select>
      </SettingRow>

      <SettingRow label={ts('dailyNotesOptions.templateFile.label')} description={ts('dailyNotesOptions.templateFile.description')}>
        <input
          type="text"
          value={settings.dailyNotesTemplate}
          onChange={(e) => settings.update({ dailyNotesTemplate: e.target.value })}
          className="text-xs px-2 py-1 rounded outline-none w-40"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
          placeholder={ts('dailyNotesOptions.templateFile.placeholder')}
        />
      </SettingRow>

      {/* Periodic Notes */}
      {([
        { label: ts('dailyNotesOptions.periodicNotes.weekly'), prefix: 'weeklyNotes' as const, defaultFolder: 'weekly', formats: ['YYYY-[W]WW', 'GGGG-[W]WW'] },
        { label: ts('dailyNotesOptions.periodicNotes.monthly'), prefix: 'monthlyNotes' as const, defaultFolder: 'monthly', formats: ['YYYY-MM', 'MM-YYYY'] },
        { label: ts('dailyNotesOptions.periodicNotes.quarterly'), prefix: 'quarterlyNotes' as const, defaultFolder: 'quarterly', formats: ['YYYY-[Q]Q', '[Q]Q-YYYY'] },
        { label: ts('dailyNotesOptions.periodicNotes.yearly'), prefix: 'yearlyNotes' as const, defaultFolder: 'yearly', formats: ['YYYY', '[Y]YYYY'] },
      ] as const).map(({ label, prefix, defaultFolder, formats }) => (
        <div key={prefix}>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2 mt-3" style={{ color: 'var(--ctp-accent)' }}>
            {ts('dailyNotesOptions.periodicNotes.notesLabel', { period: label })}
          </div>
          <div className="flex flex-col gap-3">
            <SettingRow label={ts('dailyNotesOptions.periodicNotes.folder.label')} description={ts('dailyNotesOptions.periodicNotes.folder.description', { period: label.toLowerCase() })}>
              <input
                type="text"
                value={settings[`${prefix}Folder`]}
                onChange={(e) => settings.update({ [`${prefix}Folder`]: e.target.value } as Partial<Settings>)}
                className="text-xs px-2 py-1 rounded outline-none w-32"
                style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface2)' }}
                placeholder={defaultFolder}
              />
            </SettingRow>
            <SettingRow label={ts('dailyNotesOptions.periodicNotes.format.label')} description={ts('dailyNotesOptions.periodicNotes.format.description', { period: label.toLowerCase() })}>
              <select
                value={settings[`${prefix}Format`]}
                onChange={(e) => settings.update({ [`${prefix}Format`]: e.target.value } as Partial<Settings>)}
                className="text-xs px-2 py-1 rounded outline-none"
                style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface2)' }}
              >
                {formats.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </SettingRow>
            <SettingRow label={ts('dailyNotesOptions.periodicNotes.template.label')} description={ts('dailyNotesOptions.periodicNotes.template.description', { period: label.toLowerCase() })}>
              <input
                type="text"
                value={settings[`${prefix}Template`]}
                onChange={(e) => settings.update({ [`${prefix}Template`]: e.target.value } as Partial<Settings>)}
                className="text-xs px-2 py-1 rounded outline-none w-40"
                style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)', border: '1px solid var(--ctp-surface2)' }}
                placeholder={`templates/${label.toLowerCase()}.md`}
              />
            </SettingRow>
          </div>
        </div>
      ))}
      <FeatureWiki featureId="dailynotes-options" />
    </div>
  );
}

function CodeFoldingOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('codeFoldingOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('codeFoldingOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('codeFoldingOptions.foldHeadings.label')} description={ts('codeFoldingOptions.foldHeadings.description')}>
        <ToggleSwitch
          checked={settings.foldHeadings}
          onChange={(v) => settings.update({ foldHeadings: v })}
        />
      </SettingRow>

      <SettingRow label={ts('codeFoldingOptions.foldCodeBlocks.label')} description={ts('codeFoldingOptions.foldCodeBlocks.description')}>
        <ToggleSwitch
          checked={settings.foldCodeBlocks}
          onChange={(v) => settings.update({ foldCodeBlocks: v })}
        />
      </SettingRow>

      <SettingRow label={ts('codeFoldingOptions.minFoldLevel.label')} description={ts('codeFoldingOptions.minFoldLevel.description')}>
        <select
          value={settings.foldMinLevel}
          onChange={(e) => settings.update({ foldMinLevel: Number(e.target.value) })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value={1}>{ts('codeFoldingOptions.minFoldLevel.h1')}</option>
          <option value={2}>{ts('codeFoldingOptions.minFoldLevel.h2')}</option>
          <option value={3}>{ts('codeFoldingOptions.minFoldLevel.h3')}</option>
          <option value={4}>{ts('codeFoldingOptions.minFoldLevel.h4')}</option>
          <option value={5}>{ts('codeFoldingOptions.minFoldLevel.h5')}</option>
          <option value={6}>{ts('codeFoldingOptions.minFoldLevel.h6')}</option>
        </select>
      </SettingRow>
      <FeatureWiki featureId="codefolding-options" />
    </div>
  );
}

function HighlightOptionsPage({ settings }: OptionsPageProps) {
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

function PropertiesOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('propertiesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('propertiesOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('propertiesOptions.showTypes.label')} description={ts('propertiesOptions.showTypes.description')}>
        <ToggleSwitch
          checked={settings.propertiesShowTypes}
          onChange={(v) => settings.update({ propertiesShowTypes: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="properties-options" />
    </div>
  );
}

function StatusBarOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('statusBarOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('statusBarOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('statusBarOptions.wordCount.label')} description={ts('statusBarOptions.wordCount.description')}>
        <ToggleSwitch
          checked={settings.statusBarWords}
          onChange={(v) => settings.update({ statusBarWords: v })}
        />
      </SettingRow>

      <SettingRow label={ts('statusBarOptions.characterCount.label')} description={ts('statusBarOptions.characterCount.description')}>
        <ToggleSwitch
          checked={settings.statusBarChars}
          onChange={(v) => settings.update({ statusBarChars: v })}
        />
      </SettingRow>

      <SettingRow label={ts('statusBarOptions.readingTime.label')} description={ts('statusBarOptions.readingTime.description')}>
        <ToggleSwitch
          checked={settings.statusBarReadingTime}
          onChange={(v) => settings.update({ statusBarReadingTime: v })}
        />
      </SettingRow>

      <SettingRow label={ts('statusBarOptions.selectionStats.label')} description={ts('statusBarOptions.selectionStats.description')}>
        <ToggleSwitch
          checked={settings.statusBarSelection}
          onChange={(v) => settings.update({ statusBarSelection: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="statusbar-options" />
    </div>
  );
}

function AutoSaveOptionsPage({ settings, intervalValue, setIntervalValue, commitInterval }: OptionsPageProps & { intervalValue: string; setIntervalValue: (v: string) => void; commitInterval: () => void }) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('autoSaveOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('autoSaveOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('autoSaveOptions.saveMode.label')} description={ts('autoSaveOptions.saveMode.description')}>
        <select
          value={settings.autoSaveMode}
          onChange={(e) => settings.update({ autoSaveMode: e.target.value as import('../stores/settings-store').AutoSaveMode })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value="focus-change">{ts('autoSaveOptions.saveMode.focusChange')}</option>
          <option value="timer">{ts('autoSaveOptions.saveMode.timer')}</option>
        </select>
      </SettingRow>

      {settings.autoSaveMode === 'timer' && (
        <SettingRow label={ts('autoSaveOptions.saveInterval.label')} description={ts('autoSaveOptions.saveInterval.description')}>
          <input
            type="number"
            min={500}
            max={30000}
            step={100}
            value={intervalValue}
            onChange={(e) => setIntervalValue(e.target.value)}
            onBlur={commitInterval}
            onKeyDown={(e) => { if (e.key === 'Enter') commitInterval(); }}
            className="text-xs px-2 py-1 rounded outline-none w-20 text-right"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface2)',
            }}
          />
        </SettingRow>
      )}
      <FeatureWiki featureId="autosave-options" />
    </div>
  );
}

function SpellcheckOptionsPage() {
  const { t: ts } = useTranslation('settings');
  const spellcheck = useSettingsStore((s) => s.spellcheck);
  const spellcheckSkipCapitalized = useSettingsStore((s) => s.spellcheckSkipCapitalized);
  const update = useSettingsStore((s) => s.update);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const [dictWords, setDictWords] = useState<string[]>([]);
  const [dictLoading, setDictLoading] = useState(false);
  const [newWord, setNewWord] = useState('');

  // Load custom dictionary words
  useEffect(() => {
    if (!vaultPath) return;
    setDictLoading(true);
    readCustomDictionary(vaultPath)
      .then((words) => setDictWords(words.sort((a, b) => a.localeCompare(b))))
      .catch(() => setDictWords([]))
      .finally(() => setDictLoading(false));
  }, [vaultPath]);

  const removeWord = useCallback((word: string) => {
    if (!vaultPath) return;
    const updated = dictWords.filter((w) => w !== word);
    setDictWords(updated);
    writeCustomDictionary(vaultPath, updated)
      .then(() => reloadCustomDictionary())
      .catch((err) => console.warn('Failed to update dictionary:', err));
  }, [vaultPath, dictWords]);

  const addWord = useCallback(() => {
    if (!vaultPath || !newWord.trim()) return;
    const lower = newWord.trim().toLowerCase();
    if (dictWords.includes(lower)) { setNewWord(''); return; }
    const updated = [...dictWords, lower].sort((a, b) => a.localeCompare(b));
    setDictWords(updated);
    setNewWord('');
    writeCustomDictionary(vaultPath, updated)
      .then(() => reloadCustomDictionary())
      .catch((err) => console.warn('Failed to update dictionary:', err));
  }, [vaultPath, dictWords, newWord]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('spellcheckOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('spellcheckOptions.description')}
        </span>
      </div>
      <SettingRow label={ts('spellcheckOptions.enableSpellcheck.label')} description={ts('spellcheckOptions.enableSpellcheck.description')}>
        <ToggleSwitch
          checked={spellcheck}
          onChange={(v) => update({ spellcheck: v })}
        />
      </SettingRow>
      <SettingRow label={ts('spellcheckOptions.skipCapitalized.label')} description={ts('spellcheckOptions.skipCapitalized.description')}>
        <ToggleSwitch
          checked={spellcheckSkipCapitalized}
          onChange={(v) => update({ spellcheckSkipCapitalized: v })}
        />
      </SettingRow>

      {/* Custom Dictionary Management */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('spellcheckOptions.customDictionary.title')}</span>
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {ts('spellcheckOptions.customDictionary.description')}
          </span>
        </div>

        {/* Add word input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addWord(); }}
            placeholder={ts('spellcheckOptions.customDictionary.addPlaceholder')}
            className="flex-1 text-xs rounded px-2 py-1.5"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface1)',
              outline: 'none',
            }}
          />
          <button
            onClick={addWord}
            disabled={!newWord.trim()}
            className="text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-30"
            style={{
              backgroundColor: 'var(--ctp-accent)',
              color: 'var(--ctp-base)',
            }}
          >
            {ts('spellcheckOptions.customDictionary.add')}
          </button>
        </div>

        {/* Word list */}
        <div
          className="rounded overflow-hidden"
          style={{ border: '1px solid var(--ctp-surface0)' }}
        >
          {dictLoading ? (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{ts('spellcheckOptions.customDictionary.loading')}</span>
            </div>
          ) : dictWords.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{ts('spellcheckOptions.customDictionary.noWords')}</span>
            </div>
          ) : (
            <div
              className="flex flex-col overflow-y-auto"
              style={{ maxHeight: 200 }}
            >
              {dictWords.map((word) => (
                <div
                  key={word}
                  className="flex items-center justify-between px-3 py-1.5 group transition-colors"
                  style={{ borderBottom: '1px solid var(--ctp-surface0)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--ctp-surface0)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span className="text-xs font-mono" style={{ color: 'var(--ctp-text)' }}>{word}</span>
                  <button
                    onClick={() => removeWord(word)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--ctp-red)' }}
                    title={ts('spellcheckOptions.customDictionary.removeWord', { word })}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {dictWords.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            {dictWords.length === 1 ? ts('spellcheckOptions.customDictionary.wordCount', { count: dictWords.length }) : ts('spellcheckOptions.customDictionary.wordCountPlural', { count: dictWords.length })}
          </span>
        )}
      </div>

      <FeatureWiki featureId="spellcheck-options" />
    </div>
  );
}

function TemplatesOptionsPage(_props: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('templatesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('templatesOptions.description')}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('templatesOptions.availableVariables')}</span>
        <div className="flex flex-col gap-2">
          {([
            ['{{title}}', ts('templatesOptions.variables.title')],
            ['{{date}}', ts('templatesOptions.variables.date')],
            ['{{time}}', ts('templatesOptions.variables.time')],
            ['{{datetime}}', ts('templatesOptions.variables.datetime')],
            ['{{date:FORMAT}}', ts('templatesOptions.variables.dateFormat')],
            ['{{clipboard}}', ts('templatesOptions.variables.clipboard')],
            ['{{cursor}}', ts('templatesOptions.variables.cursor')],
          ] as const).map(([variable, desc]) => (
            <div key={variable} className="flex items-start gap-3">
              <code
                className="px-1.5 py-0.5 rounded text-xs font-mono shrink-0"
                style={{ backgroundColor: 'var(--ctp-crust)', color: 'var(--ctp-accent)', border: '1px solid var(--ctp-surface1)' }}
              >
                {variable}
              </code>
              <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
      <FeatureWiki featureId="templates-options" />
    </div>
  );
}

function SearchOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('searchOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('searchOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('searchOptions.caseSensitive.label')} description={ts('searchOptions.caseSensitive.description')}>
        <ToggleSwitch
          checked={settings.searchCaseSensitive}
          onChange={(v) => settings.update({ searchCaseSensitive: v })}
        />
      </SettingRow>

      <SettingRow label={ts('searchOptions.useRegex.label')} description={ts('searchOptions.useRegex.description')}>
        <ToggleSwitch
          checked={settings.searchRegex}
          onChange={(v) => settings.update({ searchRegex: v })}
        />
      </SettingRow>

      <SettingRow label={ts('searchOptions.wholeWord.label')} description={ts('searchOptions.wholeWord.description')}>
        <ToggleSwitch
          checked={settings.searchWholeWord}
          onChange={(v) => settings.update({ searchWholeWord: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="search-options" />
    </div>
  );
}

function FocusModeOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('focusModeOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('focusModeOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('focusModeOptions.dimParagraphs.label')} description={ts('focusModeOptions.dimParagraphs.description')}>
        <ToggleSwitch
          checked={settings.focusModeDimParagraphs}
          onChange={(v) => settings.update({ focusModeDimParagraphs: v })}
        />
      </SettingRow>

      <SettingRow label={ts('focusModeOptions.typewriterScrolling.label')} description={ts('focusModeOptions.typewriterScrolling.description')}>
        <ToggleSwitch
          checked={settings.focusModeTypewriter}
          onChange={(v) => settings.update({ focusModeTypewriter: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="focusmode-options" />
    </div>
  );
}

function WordCountGoalOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('wordCountGoalOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('wordCountGoalOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('wordCountGoalOptions.targetWords.label')} description={ts('wordCountGoalOptions.targetWords.description')}>
        <input
          type="number"
          min={1}
          max={100000}
          step={100}
          value={settings.wordCountGoalTarget}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n > 0) settings.update({ wordCountGoalTarget: n });
          }}
          className="text-xs px-2 py-1 rounded outline-none w-20 text-right"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        />
      </SettingRow>

      <SettingRow label={ts('wordCountGoalOptions.showInStatusBar.label')} description={ts('wordCountGoalOptions.showInStatusBar.description')}>
        <ToggleSwitch
          checked={settings.wordCountGoalShowStatusBar}
          onChange={(v) => settings.update({ wordCountGoalShowStatusBar: v })}
        />
      </SettingRow>

      <SettingRow label={ts('wordCountGoalOptions.notifyOnReach.label')} description={ts('wordCountGoalOptions.notifyOnReach.description')}>
        <ToggleSwitch
          checked={settings.wordCountGoalNotify}
          onChange={(v) => settings.update({ wordCountGoalNotify: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="wordcountgoal-options" />
    </div>
  );
}

function CanvasOptionsPage() {
  const { t: ts } = useTranslation('settings');
  const canvasSnapToGrid = useSettingsStore((s) => s.canvasSnapToGrid);
  const canvasGridSize = useSettingsStore((s) => s.canvasGridSize);
  const canvasDefaultCardWidth = useSettingsStore((s) => s.canvasDefaultCardWidth);
  const canvasDefaultCardHeight = useSettingsStore((s) => s.canvasDefaultCardHeight);
  const canvasShowMinimap = useSettingsStore((s) => s.canvasShowMinimap);
  const canvasAutoLayout = useSettingsStore((s) => s.canvasAutoLayout);
  const canvasEdgeStyle = useSettingsStore((s) => s.canvasEdgeStyle);
  const canvasShowEdgeLabels = useSettingsStore((s) => s.canvasShowEdgeLabels);
  const canvasExportBackground = useSettingsStore((s) => s.canvasExportBackground);
  const update = useSettingsStore((s) => s.update);

  const inputStyle = {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface2)',
  };
  const selectStyle = {
    ...inputStyle,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c7086' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 6px center',
    paddingRight: '22px',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('canvasOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('canvasOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('canvasOptions.snapToGrid.label')} description={ts('canvasOptions.snapToGrid.description')}>
        <ToggleSwitch
          checked={canvasSnapToGrid}
          onChange={(v) => update({ canvasSnapToGrid: v })}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.gridSize.label')} description={ts('canvasOptions.gridSize.description')}>
        <input
          type="number"
          min={10}
          max={100}
          step={5}
          value={canvasGridSize}
          onChange={(e) => update({ canvasGridSize: Math.max(10, Math.min(100, Number(e.target.value) || 20)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>


      <SettingRow label={ts('canvasOptions.defaultCardWidth.label')} description={ts('canvasOptions.defaultCardWidth.description')}>
        <input
          type="number"
          min={100}
          max={800}
          step={10}
          value={canvasDefaultCardWidth}
          onChange={(e) => update({ canvasDefaultCardWidth: Math.max(100, Math.min(800, Number(e.target.value) || 260)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.defaultCardHeight.label')} description={ts('canvasOptions.defaultCardHeight.description')}>
        <input
          type="number"
          min={60}
          max={600}
          step={10}
          value={canvasDefaultCardHeight}
          onChange={(e) => update({ canvasDefaultCardHeight: Math.max(60, Math.min(600, Number(e.target.value) || 140)) })}
          className="text-xs px-2 py-1 rounded outline-none w-16 text-center"
          style={inputStyle}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.showMinimap.label')} description={ts('canvasOptions.showMinimap.description')}>
        <ToggleSwitch
          checked={canvasShowMinimap}
          onChange={(v) => update({ canvasShowMinimap: v })}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.autoLayout.label')} description={ts('canvasOptions.autoLayout.description')}>
        <select
          value={canvasAutoLayout}
          onChange={(e) => update({ canvasAutoLayout: e.target.value as 'none' | 'grid' | 'tree' | 'force' })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={selectStyle}
        >
          <option value="none">{ts('canvasOptions.autoLayout.none')}</option>
          <option value="grid">{ts('canvasOptions.autoLayout.grid')}</option>
          <option value="tree">{ts('canvasOptions.autoLayout.tree')}</option>
          <option value="force">{ts('canvasOptions.autoLayout.force')}</option>
        </select>
      </SettingRow>

      <SettingRow label={ts('canvasOptions.edgeStyle.label')} description={ts('canvasOptions.edgeStyle.description')}>
        <select
          value={canvasEdgeStyle}
          onChange={(e) => update({ canvasEdgeStyle: e.target.value as 'bezier' | 'straight' | 'step' })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={selectStyle}
        >
          <option value="bezier">{ts('canvasOptions.edgeStyle.bezier')}</option>
          <option value="straight">{ts('canvasOptions.edgeStyle.straight')}</option>
          <option value="step">{ts('canvasOptions.edgeStyle.step')}</option>
        </select>
      </SettingRow>

      <SettingRow label={ts('canvasOptions.showEdgeLabels.label')} description={ts('canvasOptions.showEdgeLabels.description')}>
        <ToggleSwitch
          checked={canvasShowEdgeLabels}
          onChange={(v) => update({ canvasShowEdgeLabels: v })}
        />
      </SettingRow>

      <SettingRow label={ts('canvasOptions.exportBackground.label')} description={ts('canvasOptions.exportBackground.description')}>
        <ToggleSwitch
          checked={canvasExportBackground}
          onChange={(v) => update({ canvasExportBackground: v })}
        />
      </SettingRow>

      <FeatureWiki featureId="canvas-options" />
    </div>
  );
}

function BookmarksOptionsPage() {
  const { t: ts } = useTranslation('settings');
  const enableBookmarks = useSettingsStore((s) => s.enableBookmarks);
  const update = useSettingsStore((s) => s.update);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('bookmarksOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('bookmarksOptions.description')}
        </span>
      </div>
      <SettingRow label={ts('bookmarksOptions.enableBookmarks.label')} description={ts('bookmarksOptions.enableBookmarks.description')}>
        <ToggleSwitch
          checked={enableBookmarks}
          onChange={(v) => update({ enableBookmarks: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="bookmarks-options" />
    </div>
  );
}

function TypewriterOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('typewriterOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('typewriterOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('typewriterOptions.verticalOffset.label')} description={ts('typewriterOptions.verticalOffset.description')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={10}
            max={90}
            value={settings.typewriterOffset}
            onChange={(e) => settings.update({ typewriterOffset: Number(e.target.value) })}
            className="flex-1 accent-[var(--ctp-accent)]"
            style={{ maxWidth: 120 }}
          />
          <span className="text-xs w-8 text-right" style={{ color: 'var(--ctp-subtext1)' }}>
            {settings.typewriterOffset}%
          </span>
        </div>
      </SettingRow>
      <FeatureWiki featureId="typewriter-options" />
    </div>
  );
}

function IndentGuidesOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('indentGuidesOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('indentGuidesOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('indentGuidesOptions.guideColor.label')} description={ts('indentGuidesOptions.guideColor.description')}>
        <select
          value={settings.indentGuideColor}
          onChange={(e) => settings.update({ indentGuideColor: e.target.value as AccentColor })}
          className="text-xs px-2 py-1 rounded outline-none capitalize"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          {['rosewater','flamingo','pink','mauve','red','maroon','peach','yellow','green','teal','sky','sapphire','blue','lavender'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label={ts('indentGuidesOptions.guideStyle.label')} description={ts('indentGuidesOptions.guideStyle.description')}>
        <select
          value={settings.indentGuideStyle}
          onChange={(e) => settings.update({ indentGuideStyle: e.target.value as IndentGuideStyle })}
          className="text-xs px-2 py-1 rounded outline-none capitalize"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value="solid">{ts('indentGuidesOptions.guideStyle.solid')}</option>
          <option value="dashed">{ts('indentGuidesOptions.guideStyle.dashed')}</option>
          <option value="dotted">{ts('indentGuidesOptions.guideStyle.dotted')}</option>
        </select>
      </SettingRow>
      <FeatureWiki featureId="indentguides-options" />
    </div>
  );
}

function ImagePreviewOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('imagePreviewOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('imagePreviewOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('imagePreviewOptions.maxHeight.label')} description={ts('imagePreviewOptions.maxHeight.description')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={100}
            max={800}
            step={50}
            value={settings.imagePreviewMaxHeight}
            onChange={(e) => settings.update({ imagePreviewMaxHeight: Number(e.target.value) })}
            className="flex-1 accent-[var(--ctp-accent)]"
            style={{ maxWidth: 120 }}
          />
          <span className="text-xs w-10 text-right" style={{ color: 'var(--ctp-subtext1)' }}>
            {settings.imagePreviewMaxHeight}px
          </span>
        </div>
      </SettingRow>
      <FeatureWiki featureId="imagepreview-options" />
    </div>
  );
}

function MediaViewerOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('mediaViewerOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('mediaViewerOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('mediaViewerOptions.pdfDefaultZoom.label')} description={ts('mediaViewerOptions.pdfDefaultZoom.description')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={25}
            max={400}
            step={25}
            value={settings.pdfDefaultZoom}
            onChange={(e) => settings.update({ pdfDefaultZoom: Number(e.target.value) })}
            className="flex-1 accent-[var(--ctp-accent)]"
            style={{ maxWidth: 120 }}
          />
          <span className="text-xs w-10 text-right" style={{ color: 'var(--ctp-subtext1)' }}>
            {settings.pdfDefaultZoom}%
          </span>
        </div>
      </SettingRow>

      <SettingRow label={ts('mediaViewerOptions.imageDefaultZoom.label')} description={ts('mediaViewerOptions.imageDefaultZoom.description')}>
        <select
          value={settings.imageDefaultZoom}
          onChange={(e) => settings.update({ imageDefaultZoom: e.target.value as 'fit' | 'actual' })}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{
            backgroundColor: 'var(--ctp-surface0)',
            color: 'var(--ctp-text)',
            border: '1px solid var(--ctp-surface2)',
          }}
        >
          <option value="fit">{ts('mediaViewerOptions.imageDefaultZoom.fitToView')}</option>
          <option value="actual">{ts('mediaViewerOptions.imageDefaultZoom.actualSize')}</option>
        </select>
      </SettingRow>
      <FeatureWiki featureId="mediaviewer-options" />
    </div>
  );
}

function TocOptionsPage({ settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('tocOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('tocOptions.description')}
        </span>
      </div>

      <SettingRow label={ts('tocOptions.autoUpdateOnSave.label')} description={ts('tocOptions.autoUpdateOnSave.description')}>
        <ToggleSwitch
          checked={settings.tocAutoUpdate}
          onChange={(v) => settings.update({ tocAutoUpdate: v })}
        />
      </SettingRow>
      <FeatureWiki featureId="toc-options" />
    </div>
  );
}

function SyncOptionsPage({ settings }: OptionsPageProps) {
  const update = useSettingsStore.getState().update;
  const vaultPath = useVaultStore.getState().vaultPath;
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<string | null>(null);
  const [showPat, setShowPat] = useState(false);
  const [pat, setPat] = useState('');
  const [patLoaded, setPatLoaded] = useState(false);

  // Load PAT from OS credential store on mount
  useEffect(() => {
    if (vaultPath && !patLoaded) {
      readSyncPat(vaultPath).then((stored) => {
        if (stored) setPat(stored);
        setPatLoaded(true);
      }).catch(() => setPatLoaded(true));
    }
  }, [vaultPath, patLoaded]);

  const handlePatChange = (value: string) => {
    setPat(value);
    if (vaultPath) {
      storeSyncPat(vaultPath, value).catch(() => {/* toast handled by keyring error */});
    }
  };

  const isConnected = syncStatus !== 'disconnected';

  const handleTestConnection = async () => {
    if (!settings.syncRepoUrl || !pat) return;
    setTesting(true);
    setTestResult(null);
    try {
      await gitTestConnection(settings.syncRepoUrl, pat);
      setTestResult('success');
    } catch {
      setTestResult('error');
    }
    setTesting(false);
  };

  const handleConnect = async () => {
    if (!vaultPath || !settings.syncRepoUrl || !pat) return;
    setConnecting(true);
    setConnectResult(null);
    try {
      const status = await gitStatusCmd(vaultPath);
      if (status.is_repo && status.has_remote) {
        setConnectResult('Connected — sync enabled');
      } else {
        await gitInitRepo(vaultPath, settings.syncRepoUrl, pat);
        setConnectResult('Repository initialized — initial push complete');
      }
      useSyncStore.getState().refreshStatus();
    } catch (err: unknown) {
      setConnectResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    if (!vaultPath) return;
    try {
      await gitDisconnect(vaultPath);
      await deleteSyncPat(vaultPath);
      setPat('');
      useSyncStore.getState().reset();
      setConnectResult(null);
      setTestResult(null);
    } catch (err: unknown) {
      setConnectResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid var(--ctp-surface1)',
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    fontSize: 13,
    outline: 'none',
  };

  const formatAgo = (ts: number | null) => {
    if (!ts) return 'never';
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>GitHub Sync</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          Sync your vault to a GitHub repository for backup and cross-device access.
        </span>
      </div>

      {/* Connection Status Banner */}
      {isConnected && (
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3"
          style={{
            backgroundColor: syncStatus === 'error' ? 'color-mix(in srgb, var(--ctp-red) 10%, var(--ctp-mantle))' : 'color-mix(in srgb, var(--ctp-green) 10%, var(--ctp-mantle))',
            border: `1px solid ${syncStatus === 'error' ? 'var(--ctp-red)' : 'var(--ctp-green)'}`,
          }}
        >
          <Cloud size={16} style={{ color: syncStatus === 'error' ? 'var(--ctp-red)' : 'var(--ctp-green)', flexShrink: 0 }} />
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-text)' }}>
              {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync Error' : syncStatus === 'offline' ? 'Offline — commits pending' : 'Connected'}
            </span>
            <span className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
              {settings.syncRepoUrl ? settings.syncRepoUrl.replace(/\.git$/, '').replace(/^https:\/\/github\.com\//, '') : 'No repository'} · Last synced {formatAgo(lastSyncTime)}
            </span>
          </div>
          <button
            onClick={() => useSyncStore.getState().triggerSync()}
            disabled={syncStatus === 'syncing'}
            className="text-xs px-2.5 py-1 rounded"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface1)',
              cursor: syncStatus === 'syncing' ? 'default' : 'pointer',
              opacity: syncStatus === 'syncing' ? 0.5 : 1,
            }}
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Repository Settings */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>Repository</span>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>Repository URL</label>
          <input
            type="text"
            value={settings.syncRepoUrl}
            placeholder="https://github.com/username/vault.git"
            onChange={(e) => update({ syncRepoUrl: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: 'var(--ctp-subtext0)' }}>Personal Access Token</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPat ? 'text' : 'password'}
              value={pat}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              onChange={(e) => handlePatChange(e.target.value)}
              style={{ ...inputStyle, paddingRight: 60 }}
            />
            <button
              type="button"
              onClick={() => setShowPat((v) => !v)}
              className="text-xs"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--ctp-overlay1)',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              {showPat ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
            Generate at GitHub → Settings → Developer settings → Personal access tokens. Requires <strong>repo</strong> scope.
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleTestConnection}
            disabled={testing || !settings.syncRepoUrl || !pat}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              backgroundColor: 'var(--ctp-surface0)',
              color: 'var(--ctp-text)',
              border: '1px solid var(--ctp-surface1)',
              cursor: testing || !settings.syncRepoUrl || !pat ? 'default' : 'pointer',
              opacity: testing || !settings.syncRepoUrl || !pat ? 0.5 : 1,
            }}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={connecting || !settings.syncRepoUrl || !pat}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{
                backgroundColor: 'var(--ctp-accent)',
                color: 'var(--ctp-base)',
                border: 'none',
                cursor: connecting || !settings.syncRepoUrl || !pat ? 'default' : 'pointer',
                opacity: connecting || !settings.syncRepoUrl || !pat ? 0.5 : 1,
              }}
            >
              {connecting ? 'Connecting...' : 'Connect & Push'}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--ctp-red)',
                border: '1px solid var(--ctp-red)',
                cursor: 'pointer',
              }}
            >
              Disconnect
            </button>
          )}

          {testResult === 'success' && <span className="text-xs" style={{ color: 'var(--ctp-green)' }}>Connection successful</span>}
          {testResult === 'error' && <span className="text-xs" style={{ color: 'var(--ctp-red)' }}>Connection failed</span>}
          {connectResult && (
            <span className="text-xs" style={{ color: connectResult.startsWith('Error') ? 'var(--ctp-red)' : 'var(--ctp-green)' }}>
              {connectResult}
            </span>
          )}
        </div>
      </div>

      {/* Auto-Sync Settings */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>Auto-Sync</span>

        <SettingRow label="Automatic sync" description="Periodically sync your vault in the background">
          <ToggleSwitch
            checked={settings.syncAutoSync}
            onChange={(v) => update({ syncAutoSync: v })}
          />
        </SettingRow>

        {settings.syncAutoSync && (
          <SettingRow label="Sync interval" description="How often to sync automatically">
            <select
              value={settings.syncInterval}
              onChange={(e) => update({ syncInterval: Number(e.target.value) })}
              className="text-xs px-2 py-1 rounded outline-none"
              style={{
                backgroundColor: 'var(--ctp-surface0)',
                color: 'var(--ctp-text)',
                border: '1px solid var(--ctp-surface2)',
              }}
            >
              <option value={1}>Every minute</option>
              <option value={5}>Every 5 minutes</option>
              <option value={10}>Every 10 minutes</option>
              <option value={30}>Every 30 minutes</option>
            </select>
          </SettingRow>
        )}
      </div>

      <FeatureWiki featureId="sync-options" />
    </div>
  );
}

function QueryOptionsPage({ settings: _settings }: OptionsPageProps) {
  const { t: ts } = useTranslation('settings');
  void _settings;

  const Kw = ({ children }: { children: React.ReactNode }) => (
    <span className="font-semibold" style={{ color: 'var(--ctp-accent)' }}>{children}</span>
  );
  const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-text)' }}>{children}</code>
  );
  const ExampleBlock = ({ lines, title }: { lines: string[]; title: string }) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{title}</span>
      <div className="rounded p-3 font-mono text-xs leading-relaxed" style={{ backgroundColor: 'var(--ctp-crust)', color: 'var(--ctp-text)' }}>
        <div style={{ color: 'var(--ctp-overlay0)' }}>{'```query'}</div>
        {lines.map((line, i) => <div key={i}>{line}</div>)}
        <div style={{ color: 'var(--ctp-overlay0)' }}>{'```'}</div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-accent)' }}>{ts('queryOptions.title')}</span>
        <span className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>
          {ts('queryOptions.description')}
        </span>
      </div>

      {/* How it works */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('queryOptions.howItWorks.title')}</span>
        <div className="flex flex-col gap-2 text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
          <p>Queries read the <strong>frontmatter properties</strong> (YAML metadata) at the top of your markdown files. For example, a note with:</p>
          <div className="rounded p-2 font-mono" style={{ backgroundColor: 'var(--ctp-crust)', color: 'var(--ctp-text)' }}>
            <div style={{ color: 'var(--ctp-overlay0)' }}>---</div>
            <div>status: active</div>
            <div>priority: 5</div>
            <div>tags: [project, work]</div>
            <div style={{ color: 'var(--ctp-overlay0)' }}>---</div>
          </div>
          <p>...can be found by queries that filter on <Code>status</Code>, <Code>priority</Code>, or <Code>tags</Code>. Queries also detect inline <Code>#tags</Code> in the body of your notes.</p>
        </div>
      </div>

      {/* Syntax Reference */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('queryOptions.syntaxReference.title')}</span>
        <div className="flex flex-col gap-3 text-xs" style={{ color: 'var(--ctp-subtext0)' }}>

          {/* Output type */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.outputType')}</span>
            <div className="flex flex-col gap-1.5 pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>TABLE</Kw> <span>field1, field2, ...</span> — Displays results in a table. Each field becomes a column. A "File" column is always included.</div>
              <div><Kw>LIST</Kw> — Displays results as a bulleted list of clickable file names.</div>
            </div>
          </div>

          {/* Source filter */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.sourceFilter')}</span>
            <div className="flex flex-col gap-1.5 pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>FROM</Kw> <Code>#tag</Code> — Only include notes that have this tag (in frontmatter or inline).</div>
              <div><Kw>FROM</Kw> <Code>"folder/path"</Code> — Only include notes inside this folder (and subfolders).</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.filters')}</span>
            <div className="flex flex-col gap-1.5 pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>WHERE</Kw> field <Code>=</Code> value — Exact match</div>
              <div><Kw>WHERE</Kw> field <Code>!=</Code> value — Not equal</div>
              <div><Kw>WHERE</Kw> field <Code>&gt;</Code> value — Greater than (numeric or alphabetical)</div>
              <div><Kw>WHERE</Kw> field <Code>&lt;</Code> value — Less than</div>
              <div><Kw>WHERE</Kw> field <Code>&gt;=</Code> value — Greater than or equal</div>
              <div><Kw>WHERE</Kw> field <Code>&lt;=</Code> value — Less than or equal</div>
              <div><Kw>WHERE</Kw> field <Code>contains</Code> value — Case-insensitive substring match</div>
              <p className="mt-1">Wrap string values in quotes: <Code>WHERE status = "active"</Code>. Numbers work without quotes: <Code>WHERE priority &gt; 3</Code>. Multiple WHERE lines are combined with AND logic.</p>
            </div>
          </div>

          {/* Sorting */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.sorting')}</span>
            <div className="flex flex-col gap-1.5 pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>SORT</Kw> field <Code>ASC</Code> — Sort ascending (A-Z, 0-9). This is the default.</div>
              <div><Kw>SORT</Kw> field <Code>DESC</Code> — Sort descending (Z-A, 9-0).</div>
              <p className="mt-1">Numeric values are sorted numerically, not alphabetically (so 10 comes after 9, not after 1).</p>
            </div>
          </div>

          {/* Limit */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--ctp-subtext1)' }}>{ts('queryOptions.syntaxReference.limit')}</span>
            <div className="pl-2" style={{ borderLeft: '2px solid var(--ctp-surface1)' }}>
              <div><Kw>LIMIT</Kw> <Code>n</Code> — Show only the first n results. The total count is still displayed in the footer.</div>
            </div>
          </div>

        </div>
      </div>

      {/* Examples */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('queryOptions.examples.title')}</span>
        <div className="flex flex-col gap-4">
          <ExampleBlock
            title={ts('queryOptions.examples.booksRated')}
            lines={['TABLE author, rating, genre', 'FROM #book', 'WHERE rating >= 4', 'SORT rating DESC']}
          />
          <ExampleBlock
            title={ts('queryOptions.examples.activeProjects')}
            lines={['TABLE status, due-date, priority', 'FROM #project', 'WHERE status = "active"', 'SORT priority DESC']}
          />
          <ExampleBlock
            title={ts('queryOptions.examples.recentMeetings')}
            lines={['LIST', 'FROM "meetings"', 'SORT date DESC', 'LIMIT 10']}
          />
          <ExampleBlock
            title={ts('queryOptions.examples.keywordNotes')}
            lines={['TABLE tags, created', 'WHERE tags contains "research"']}
          />
          <ExampleBlock
            title={ts('queryOptions.examples.allNotes')}
            lines={['TABLE status, category', 'SORT category ASC']}
          />
        </div>
      </div>

      {/* Tips */}
      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--ctp-mantle)', border: '1px solid var(--ctp-surface0)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--ctp-text)' }}>{ts('queryOptions.tips.title')}</span>
        <div className="flex flex-col gap-2 text-xs" style={{ color: 'var(--ctp-subtext0)' }}>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Click on any file name in the results to open that note.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Click inside the rendered query to reveal and edit the raw query code.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>If <Code>TABLE</Code> is used without field names, all properties from matching notes will be shown.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Property names are case-sensitive. Make sure <Code>WHERE</Code> field names match your frontmatter exactly.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Tags in <Code>FROM #tag</Code> are matched case-insensitively, both in frontmatter <Code>tags:</Code> and inline <Code>#tag</Code> usage.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>List-type properties (like <Code>tags: [a, b]</Code>) are displayed as comma-separated values and can be searched with <Code>contains</Code>.</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: 'var(--ctp-accent)' }}>{'•'}</span>
            <span>Queries scan your entire vault (or the filtered subset) each time. For very large vaults, use <Code>FROM</Code> to narrow the scope.</span>
          </div>
        </div>
      </div>
      <FeatureWiki featureId="query-options" />
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative rounded-full transition-colors"
      style={{
        width: 36,
        height: 20,
        backgroundColor: checked ? 'var(--ctp-accent)' : 'var(--ctp-surface2)',
      }}
    >
      <span
        className="absolute rounded-full transition-transform"
        style={{
          width: 16,
          height: 16,
          top: 2,
          left: 0,
          backgroundColor: 'var(--ctp-base)',
          transform: checked ? 'translateX(18px)' : 'translateX(2px)',
        }}
      />
    </button>
  );
}

function RenderedMarkdown({ content }: { content: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { unified } = await import('unified');
        const remarkParse = (await import('remark-parse')).default;
        const remarkRehype = (await import('remark-rehype')).default;
        const rehypeSanitize = (await import('rehype-sanitize')).default;
        const rehypeStringify = (await import('rehype-stringify')).default;
        const result = await unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify).process(content);
        if (!cancelled) setHtml(String(result));
      } catch {
        if (!cancelled) setHtml(null);
      }
    })();
    return () => { cancelled = true; };
  }, [content]);

  if (html === null) {
    return (
      <pre className="text-xs whitespace-pre-wrap overflow-auto" style={{ color: 'var(--ctp-text)', maxHeight: 300, lineHeight: 1.6 }}>
        {content}
      </pre>
    );
  }

  return (
    <div
      className="plugin-readme text-sm"
      style={{ color: 'var(--ctp-text)', lineHeight: 1.6 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
