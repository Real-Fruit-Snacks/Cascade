import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Search, Settings as SettingsIcon, X, Puzzle } from 'lucide-react';
import { useCloseAnimation } from '../hooks/use-close-animation';
import { useSettingsStore, type Settings } from '../stores/settings-store';
import { usePluginStore } from '../stores/plugin-store';
import { useVaultStore } from '../stores/vault-store';
import { commandRegistry } from '../lib/command-registry';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { registerCustomTheme, type CustomTheme } from '../styles/catppuccin-flavors';
import { listCustomThemes } from '../lib/tauri-commands';

import {
  DEFAULT_SHORTCUTS,
  formatKeyCombo,
  CATEGORIES,
  FEATURE_OPTION_PAGES,
  type SettingsCategory,
} from './settings/shared/constants';
import { SectionHeader } from './settings/shared/SectionHeader';
import { SEARCHABLE_ITEMS, type SearchableItem } from './settings/shared/searchable-items';

import {
  EditorSettingsPage,
  AppearanceSettingsPage,
  FilesSettingsPage,
  GeneralSettingsPage,
  FeaturesSettingsPage,
  FolderColorsSettingsPage,
  ShortcutsSettingsPage,
} from './settings/pages';

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

import { PluginsSection } from './settings/marketplace';

// ── Main modal ──────────────────────────────────────────────

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
        <SettingsSidebar
          category={category}
          setCategory={setCategory}
          settings={settings}
          settingsTabs={settingsTabs}
          onResetClick={() => setShowResetConfirm(true)}
        />

        {/* Right content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Content header with search */}
          <div
            className="flex items-center px-5 shrink-0 border-b-ctp-surface0"
            style={{ height: 48 }}
          >
            <div
              className="flex items-center gap-2 flex-1 px-3 rounded-md"
              style={{
                backgroundColor: 'var(--ctp-surface0)',
                border: '1px solid var(--ctp-surface2)',
                height: 30,
              }}
            >
              <Search size={13} className="ctp-icon" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={ts('search.placeholder')}
                aria-label={ts('search.placeholder')}
                className="flex-1 text-sm outline-none bg-transparent ctp-text"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                  aria-label={ts('search.clear')}
                  className="flex items-center justify-center rounded transition-colors hover:bg-[var(--ctp-surface1)] ctp-icon"
                  style={{ width: 18, height: 18 }}
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
          <ResetConfirmDialog
            onConfirm={() => { settings.reset(); setShowResetConfirm(false); }}
            onCancel={() => setShowResetConfirm(false)}
            dialogRef={resetDialogRef}
            trapKeyDown={trapResetKeyDown}
          />
        )}
      </div>
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────

interface SettingsSidebarProps {
  category: SettingsCategory | string;
  setCategory: (cat: SettingsCategory | string) => void;
  settings: Settings & { update: (partial: Partial<Settings>) => void };
  settingsTabs: Map<string, { pluginId: string; label: string; html: string }>;
  onResetClick: () => void;
}

function SettingsSidebar({ category, setCategory, settings, settingsTabs, onResetClick }: SettingsSidebarProps) {
  const { t: ts } = useTranslation('settings');

  return (
    <div
      className="flex flex-col shrink-0 min-h-0 bg-ctp-crust border-r-ctp-surface0"
      style={{ width: '180px' }}
    >
      {/* Sidebar header */}
      <div
        className="flex items-center gap-2 px-4 shrink-0 border-b-ctp-surface0"
        style={{ height: 48 }}
      >
        <SettingsIcon size={15} className="ctp-icon-accent" />
        <span className="text-sm font-medium ctp-accent">
          {ts('title')}
        </span>
      </div>

      {/* Category list */}
      <div className="flex flex-col py-2 px-2 gap-0.5 overflow-y-auto flex-1 min-h-0 settings-sidebar-scroll">
        {CATEGORIES.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            aria-current={category === id ? 'page' : undefined}
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
            className="my-1 mx-2 border-t-ctp-surface0"
          />
        )}
        {FEATURE_OPTION_PAGES.filter((f) => settings[f.settingsKey] as boolean).sort((a, b) => ts(a.labelKey).localeCompare(ts(b.labelKey))).map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            aria-current={category === id ? 'page' : undefined}
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
            className="my-1 mx-2 border-t-ctp-surface0"
          />
        )}
        {Array.from(settingsTabs.entries()).map(([id, tab]) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            aria-current={category === id ? 'page' : undefined}
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
        className="flex items-center justify-center px-2 py-3 border-t-ctp-surface0"
      >
        <button
          onClick={onResetClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--ctp-surface0)] ctp-red"
          title={ts('reset.buttonTitle')}
        >
          <RotateCcw size={12} />
          {ts('reset.buttonLabel')}
        </button>
      </div>
    </div>
  );
}

// ── Reset confirm dialog ────────────────────────────────────

interface ResetConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  trapKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

function ResetConfirmDialog({ onConfirm, onCancel, dialogRef, trapKeyDown }: ResetConfirmDialogProps) {
  const { t: ts } = useTranslation('settings');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={dialogRef}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
          trapKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>);
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
        <div className="px-4 py-3 border-b-ctp-surface0">
          <span className="text-sm font-medium ctp-accent">
            {ts('reset.dialogTitle')}
          </span>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs ctp-subtext0" style={{ lineHeight: '1.6' }}>
            {ts('reset.dialogMessage')}
          </p>
        </div>
        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t-ctp-surface0"
        >
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--ctp-surface1)] ctp-subtext0"
          >
            {ts('reset.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-md text-xs transition-colors"
            style={{ backgroundColor: 'var(--ctp-red)', color: 'var(--ctp-base)' }}
          >
            {ts('reset.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Settings content router ─────────────────────────────────

interface SettingsContentProps {
  category: SettingsCategory | string;
  searchQuery: string;
  settingsTabs: Map<string, { pluginId: string; label: string; html: string }>;
  settings: Settings & { update: (partial: Partial<Settings>) => void; reset: () => void; getShortcut: (commandId: string, defaultShortcut: string) => string };
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
    customThemesList, loadCustomThemes, settingsTabs,
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

  const shouldShowCategory = (cat: SettingsCategory) => {
    if (!isSearching) return category === cat;
    if (cat === 'shortcuts') {
      return shortcutCommands.filter(matchShortcut).length > 0;
    }
    if (cat === 'plugins') return 'plugins'.includes(q);
    // Feature option pages — only show if the parent feature is enabled
    const featurePage = FEATURE_OPTION_PAGES.find((p) => p.id === cat);
    if (featurePage) {
      if (!settings[featurePage.settingsKey as keyof typeof settings]) return false;
      return SEARCHABLE_ITEMS.filter((i) => i.category === cat && matchItem(i)).length > 0;
    }
    return SEARCHABLE_ITEMS.filter((i) => i.category === cat && matchItem(i)).length > 0;
  };

  const visibleIds = (cat: SettingsCategory): Set<string> | null => {
    if (!isSearching) return null;
    const items = SEARCHABLE_ITEMS.filter((i) => i.category === cat && matchItem(i));
    return new Set(items.map((i) => i.id));
  };

  const noResults = isSearching && ![
    'editor', 'appearance', 'files', 'folder-colors', 'general', 'features',
    'shortcuts', 'plugins', 'sync-options',
    ...FEATURE_OPTION_PAGES.map((p) => p.id),
  ].some((cat) => shouldShowCategory(cat as SettingsCategory));

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
          <EditorSettingsPage settings={settings} visibleIds={visibleIds('editor')} isSearching={isSearching} />
        </>
      )}

      {shouldShowCategory('appearance') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.appearance')} />}
          <AppearanceSettingsPage settings={settings} visibleIds={visibleIds('appearance')} isSearching={isSearching} customThemesList={customThemesList} loadCustomThemes={loadCustomThemes} />
        </>
      )}

      {shouldShowCategory('files') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.files')} />}
          <FilesSettingsPage settings={settings} visibleIds={visibleIds('files')} isSearching={isSearching} />
        </>
      )}

      {shouldShowCategory('general') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.general')} />}
          <GeneralSettingsPage settings={settings} visibleIds={visibleIds('general')} isSearching={isSearching} />
        </>
      )}

      {shouldShowCategory('features') && (
        <>
          {isSearching && <SectionHeader label={ts('categories.features')} />}
          <FeaturesSettingsPage settings={settings} visibleIds={visibleIds('features')} isSearching={isSearching} />
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
          <FolderColorsSettingsPage settings={settings} visibleIds={visibleIds('folder-colors')} isSearching={isSearching} />
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
          <ShortcutsSettingsPage
            shortcutCommands={shortcutCommands}
            editingId={editingId}
            capturedKey={capturedKey}
            handleKeyCapture={handleKeyCapture}
            startEditing={startEditing}
            saveBinding={saveBinding}
            resetBinding={resetBinding}
            cancelEditing={cancelEditing}
            isSearching={isSearching}
            filteredCommands={isSearching ? shortcutCommands.filter(matchShortcut) : null}
          />
        </>
      )}
    </div>
  );
}
