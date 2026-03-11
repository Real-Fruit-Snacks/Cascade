import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Search, Settings as SettingsIcon, X, Puzzle } from 'lucide-react';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { useSettingsStore, DEFAULTS, type Settings, type FileSortOrder, type StartupBehavior, type AttachmentLocation, type FolderColorStyle } from '../stores/settings-store';
import { usePluginStore } from '../stores/plugin-store';
import { useVaultStore } from '../stores/vault-store';
import { commandRegistry } from '../lib/command-registry';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { flavorLabels, registerCustomTheme, unregisterCustomTheme, type CustomTheme, type FlavorColors } from '../styles/catppuccin-flavors';
import { listCustomThemes, saveCustomTheme, deleteCustomTheme } from '../lib/tauri-commands';
import type { ViewMode } from '../types/index';
import { FeatureWiki } from './FeatureWiki';

import {
  FONT_OPTIONS,
  fontLabel,
  DEFAULT_SHORTCUTS,
  formatShortcutDisplay,
  SHORTCUT_GROUPS,
  formatKeyCombo,
  CATEGORIES,
  FEATURE_OPTION_PAGES,
  type SettingsCategory,
} from './settings/shared/constants';
import { ToggleSwitch } from './settings/shared/ToggleSwitch';
import { SettingRow } from './settings/shared/SettingRow';
import { AccentColorPicker } from './settings/shared/AccentColorPicker';
import { UiFontSizeSlider } from './settings/shared/UiFontSizeSlider';
import { KeyCaptureInput } from './settings/shared/KeyCaptureInput';
import { SectionHeader } from './settings/shared/SectionHeader';
import { SubHeader } from './settings/shared/SubHeader';

import {
  WikiLinksOptionsPage,
  LivePreviewOptionsPage,
  TagsOptionsPage,
  GraphOptionsPage,
  BacklinksOptionsPage,
  OutlineOptionsPage,
  VariablesOptionsPage,
  DailyNotesOptionsPage,
  CodeFoldingOptionsPage,
  HighlightOptionsPage,
  PropertiesOptionsPage,
  StatusBarOptionsPage,
  AutoSaveOptionsPage,
  SpellcheckOptionsPage,
  TemplatesOptionsPage,
  SearchOptionsPage,
  SlashCommandsOptionsPage,
  FocusModeOptionsPage,
  WordCountGoalOptionsPage,
  CanvasOptionsPage,
  BookmarksOptionsPage,
  TypewriterOptionsPage,
  IndentGuidesOptionsPage,
  ImagePreviewOptionsPage,
  MediaViewerOptionsPage,
  TocOptionsPage,
  SyncOptionsPage,
  QueryOptionsPage,
} from './settings/options';

import { CommunityThemesSection, PluginsSection } from './settings/marketplace';

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
  { id: 'enableSlashCommands', category: 'features', keywords: 'slash commands menu inline insert toggle feature enable disable' },
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
  { id: 'slashCommandsOptions', category: 'slashcommands-options' as SettingsCategory, keywords: 'slash commands menu inline insert options' },
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
          {(!visibleFeaturesIds || visibleFeaturesIds.has('enableSlashCommands')) && (
            <SettingRow label={ts('features.slashCommands.label')} description={ts('features.slashCommands.description')}>
              <ToggleSwitch
                checked={settings.enableSlashCommands}
                onChange={(v) => settings.update({ enableSlashCommands: v })}
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

      {shouldShowCategory('slashcommands-options') && (
        <>
          {isSearching && <SectionHeader label={ts('featurePages.slashCommands')} />}
          <SlashCommandsOptionsPage settings={settings} />
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
