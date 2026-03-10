import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TitleBar } from './TitleBar';
import { Sidebar } from './sidebar/Sidebar';
import { SplitPaneContainer } from './SplitPaneContainer';
import { ErrorBoundary } from './ErrorBoundary';
import { QuickOpen } from './QuickOpen';
import type { QuickOpenMode } from './QuickOpen';
import { CommandPalette } from './CommandPalette';
import { NewFileModal } from './NewFileModal';
import { SetVariableModal } from './SetVariableModal';
import { ListVariablesModal } from './ListVariablesModal';

const SearchModal = lazy(() => import('./SearchModal').then((m) => ({ default: m.SearchModal })));
const SettingsModal = lazy(() => import('./SettingsModal').then((m) => ({ default: m.SettingsModal })));
const ExportModal = lazy(() => import('./ExportModal').then((m) => ({ default: m.ExportModal })));
const ImportWizard = lazy(() => import('./ImportWizard').then((m) => ({ default: m.ImportWizard })));
import { OnboardingScreen } from './OnboardingScreen';
import { AboutDialog } from './AboutDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { ToastContainer } from './ToastContainer';
import { FileConflictDialog } from './FileConflictDialog';
import { useToastStore } from '../stores/toast-store';
import { quickOpenBus } from '../lib/quick-open-bus';
import { useCommands } from '../hooks/use-commands';
import { commandRegistry } from '../lib/command-registry';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import type { VariableMatch } from '../lib/tidemark';
import { writeFile } from '../lib/tauri-commands';
import { useSyncTimer } from '../hooks/use-sync-timer';

const SIDEBAR_STORAGE_KEY = 'cascade-sidebar-visible';

function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1];
  const needsCtrl = parts.includes('Ctrl');
  const needsShift = parts.includes('Shift');
  const needsAlt = parts.includes('Alt');
  const needsMeta = parts.includes('Meta');

  const mod = e.ctrlKey || e.metaKey;
  const ctrlOrMeta = needsCtrl ? mod : !e.ctrlKey && !e.metaKey;
  const shift = needsShift ? e.shiftKey : !e.shiftKey;
  const alt = needsAlt ? e.altKey : !e.altKey;
  const meta = needsMeta ? e.metaKey : true; // Meta handled via ctrlOrMeta

  if (!ctrlOrMeta || !shift || !alt) return false;
  void meta;

  // Normalize key comparison
  const eventKey = e.key;
  // For letter keys: shortcut stores uppercase, event.key is case-sensitive
  return eventKey.toLowerCase() === key.toLowerCase() || eventKey === key;
}

export function AppShell() {
  const { t } = useTranslation(['common', 'dialogs']);
  useSyncTimer();
  const sidebarPosition = useSettingsStore((s) => s.sidebarPosition);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const uiFontSize = useSettingsStore((s) => s.uiFontSize);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  // Apply accent color as CSS custom property
  useEffect(() => {
    document.documentElement.style.setProperty('--ctp-accent', `var(--ctp-${accentColor})`);
  }, [accentColor]);

  // Apply UI font size
  useEffect(() => {
    document.documentElement.style.fontSize = uiFontSize + 'px';
    return () => { document.documentElement.style.fontSize = ''; };
  }, [uiFontSize]);

  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [quickOpenMode, setQuickOpenMode] = useState<QuickOpenMode>('open');
  const [insertLinkCallback, setInsertLinkCallback] = useState<((name: string) => void) | null>(null);
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [newFileModalVisible, setNewFileModalVisible] = useState(false);
  const [newCanvasModalVisible, setNewCanvasModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [exportDefaultScope, setExportDefaultScope] = useState<'current' | 'vault'>('current');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    kind: 'info' | 'warning';
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  // Variables feature modals
  const [setVarModal, setSetVarModal] = useState<{ name: string; currentValue: string } | null>(null);
  const [listVarsModal, setListVarsModal] = useState<VariableMatch[] | null>(null);

  const openQuickOpen = useCallback(() => {
    setQuickOpenMode('open');
    setInsertLinkCallback(null);
    setQuickOpenVisible(true);
  }, []);

  const openCommandPalette = useCallback(() => {
    setCommandPaletteVisible(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteVisible(false);
  }, []);

  const closeSearchModal = useCallback(() => {
    setSearchModalVisible(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const openSettings = useCallback(() => {
    setSettingsVisible(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsVisible(false);
  }, []);

  const closeExport = useCallback(() => {
    setExportVisible(false);
    setExportDefaultScope('current');
  }, []);

  const closeImport = useCallback(() => setImportVisible(false), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const closeSetVarModal = useCallback(() => setSetVarModal(null), []);
  const closeListVarsModal = useCallback(() => setListVarsModal(null), []);
  const closeConfirmDialog = useCallback(() => setConfirmDialog(null), []);

  useCommands({ openCommandPalette, openQuickOpen, toggleSidebar, openSettings });

  // Suppress the default browser context menu globally
  useEffect(() => {
    const suppress = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', suppress);
    return () => document.removeEventListener('contextmenu', suppress);
  }, []);

  // Global drag-drop support — WebView2 on Windows requires native DOM listeners
  // in the capture phase to ensure drops are allowed. React synthetic events and
  // dataTransfer.types checks are unreliable on WebView2.
  useEffect(() => {
    let isDraggingInternal = false;
    const onDragStart = () => { isDraggingInternal = true; };
    const onDragEnd = () => { isDraggingInternal = false; };
    const onDragOver = (e: DragEvent) => {
      if (!isDraggingInternal) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };
    const onDrop = (e: DragEvent) => {
      if (!isDraggingInternal) return;
      // Prevent browser default (navigating to the dragged content).
      // Actual drop logic is handled by React onDrop on specific targets.
      e.preventDefault();
      isDraggingInternal = false;
    };
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('dragend', onDragEnd, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);
    return () => {
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('dragend', onDragEnd, true);
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('drop', onDrop, true);
    };
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Dispatch shortcuts via command registry
    const cmds = commandRegistry.getAll();
    for (const cmd of cmds) {
      if (!cmd.shortcut) continue;
      if (matchesShortcut(e, cmd.shortcut)) {
        e.preventDefault();
        cmd.run();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Note: beforeunload is NOT used — onCloseRequested handles dirty-tab checks.
  // Using both causes double-blocking on Tauri v2 Windows.

  // Intercept Tauri window close (Alt+F4, taskbar close, system close)
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      if (useEditorStore.getState().hasDirtyTabs()) {
        event.preventDefault();
        setConfirmDialog({
          title: t('dialogs:unsavedChanges.title'),
          message: t('dialogs:unsavedChanges.message'),
          kind: 'warning',
          confirmLabel: t('dialogs:unsavedChanges.confirmLabel'),
          onConfirm: () => {
            setConfirmDialog(null);
            appWindow.destroy();
          },
        });
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // R1: Consolidated cascade:* event listeners
  useEffect(() => {
    const openSearch = () => {
      if (useSettingsStore.getState().enableSearch) setSearchModalVisible(true);
    };
    const newFile = () => setNewFileModalVisible(true);
    const newCanvas = () => setNewCanvasModalVisible(true);
    const openSettings = () => setSettingsVisible(true);
    const openCmdPalette = () => setCommandPaletteVisible(true);
    const openExport = () => { setExportDefaultScope('current'); setExportVisible(true); };
    const openBatchExport = () => { setExportDefaultScope('vault'); setExportVisible(true); };
    const openImport = () => setImportVisible(true);
    const openAbout = () => setAboutOpen(true);
    const doCloseVault = () => {
      const store = useEditorStore.getState();
      for (let i = store.tabs.length - 1; i >= 0; i--) {
        if (store.tabs[i].isPinned) store.unpinTab(i);
        store.closeTab(i, true);
      }
      useVaultStore.getState().closeVault();
    };
    const closeVault = (e: Event) => {
      // Skip confirm dialog when force flag is set (programmatic use)
      if ((e as CustomEvent).detail?.force) {
        doCloseVault();
        return;
      }
      const hasDirty = useEditorStore.getState().hasDirtyTabs();
      setConfirmDialog({
        title: t('dialogs:closeVault.title'),
        message: hasDirty
          ? t('dialogs:closeVault.messageDirty')
          : t('dialogs:closeVault.messageClean'),
        kind: hasDirty ? 'warning' : 'info',
        confirmLabel: t('dialogs:closeVault.confirmLabel'),
        onConfirm: () => {
          setConfirmDialog(null);
          doCloseVault();
        },
      });
    };

    const events: [string, EventListener][] = [
      ['cascade:open-search', openSearch],
      ['cascade:new-file', newFile],
      ['cascade:new-canvas', newCanvas],
      ['cascade:open-settings', openSettings],
      ['cascade:open-command-palette', openCmdPalette],
      ['cascade:export', openExport],
      ['cascade:export-batch', openBatchExport],
      ['cascade:import', openImport],
      ['cascade:close-vault', closeVault],
      ['cascade:about', openAbout],
    ];
    for (const [evt, fn] of events) window.addEventListener(evt, fn);
    return () => { for (const [evt, fn] of events) window.removeEventListener(evt, fn); };
  }, []);

  // Variables commands
  useEffect(() => {
    const handleReplaceAll = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      const vaultPath = useVaultStore.getState().vaultPath;
      if (!view || !vaultPath) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const s = useSettingsStore.getState();
      const opts = {
        openDelimiter: s.variablesOpenDelimiter,
        closeDelimiter: s.variablesCloseDelimiter,
        defaultSeparator: s.variablesDefaultSeparator,
        missingValueText: s.variablesMissingText,
        supportNesting: s.variablesSupportNesting,
        caseInsensitive: s.variablesCaseInsensitive,
        arrayJoinSeparator: s.variablesArrayJoinSeparator,
        preserveOnMissing: s.variablesPreserveOnMissing,
      };

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      if (!fm) return;
      const frontmatter = parseFrontmatter(fm.raw);
      const body = doc.slice(fm.bodyStart);
      const replaced = replaceVariables(body, frontmatter, opts);
      if (replaced !== body) {
        view.dispatch({
          changes: { from: fm.bodyStart, to: doc.length, insert: replaced },
        });
      }
    };

    const handleCopyReplaced = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const s = useSettingsStore.getState();
      const opts = {
        openDelimiter: s.variablesOpenDelimiter,
        closeDelimiter: s.variablesCloseDelimiter,
        defaultSeparator: s.variablesDefaultSeparator,
        missingValueText: s.variablesMissingText,
        supportNesting: s.variablesSupportNesting,
        caseInsensitive: s.variablesCaseInsensitive,
        arrayJoinSeparator: s.variablesArrayJoinSeparator,
        preserveOnMissing: s.variablesPreserveOnMissing,
      };

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      if (!fm) {
        await navigator.clipboard.writeText(doc);
        return;
      }
      const frontmatter = parseFrontmatter(fm.raw);
      const body = doc.slice(fm.bodyStart);
      const replaced = replaceVariables(body, frontmatter, opts);
      await navigator.clipboard.writeText(replaced);
    };

    const handleSetVariable = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, getVariableAtPosition } = await import('../lib/tidemark');
      const s = useSettingsStore.getState();
      const opts = {
        openDelimiter: s.variablesOpenDelimiter,
        closeDelimiter: s.variablesCloseDelimiter,
        defaultSeparator: s.variablesDefaultSeparator,
        missingValueText: s.variablesMissingText,
        supportNesting: s.variablesSupportNesting,
        caseInsensitive: s.variablesCaseInsensitive,
        arrayJoinSeparator: s.variablesArrayJoinSeparator,
        preserveOnMissing: s.variablesPreserveOnMissing,
      };

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const bodyStart = fm?.bodyStart ?? 0;
      const body = doc.slice(bodyStart);
      const cursor = view.state.selection.main.head;
      const bodyOffset = cursor - bodyStart;

      const match = getVariableAtPosition(body, bodyOffset, frontmatter, opts);
      if (!match) {
        useToastStore.getState().addToast(t('common:noVariableAtCursor'), 'info');
        return;
      }

      const currentVal = match.status === 'exists' ? match.resolvedValue : '';
      setSetVarModal({ name: match.name, currentValue: currentVal });
    };

    const handleListVariables = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, scanDocumentVariables } = await import('../lib/tidemark');
      const s = useSettingsStore.getState();
      const opts = {
        openDelimiter: s.variablesOpenDelimiter,
        closeDelimiter: s.variablesCloseDelimiter,
        defaultSeparator: s.variablesDefaultSeparator,
        missingValueText: s.variablesMissingText,
        supportNesting: s.variablesSupportNesting,
        caseInsensitive: s.variablesCaseInsensitive,
        arrayJoinSeparator: s.variablesArrayJoinSeparator,
        preserveOnMissing: s.variablesPreserveOnMissing,
      };

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const body = doc.slice(fm?.bodyStart ?? 0);
      const vars = scanDocumentVariables(body, frontmatter, opts);
      setListVarsModal(vars);
    };

    const handleCopyLineReplaced = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const s = useSettingsStore.getState();
      const opts = {
        openDelimiter: s.variablesOpenDelimiter,
        closeDelimiter: s.variablesCloseDelimiter,
        defaultSeparator: s.variablesDefaultSeparator,
        missingValueText: s.variablesMissingText,
        supportNesting: s.variablesSupportNesting,
        caseInsensitive: s.variablesCaseInsensitive,
        arrayJoinSeparator: s.variablesArrayJoinSeparator,
        preserveOnMissing: s.variablesPreserveOnMissing,
      };

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      const replaced = replaceVariables(line.text, frontmatter, opts);
      await navigator.clipboard.writeText(replaced);
      useToastStore.getState().addToast(t('common:lineCopiedWithVariables'), 'success');
    };

    const handleCopySelectionReplaced = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const s = useSettingsStore.getState();
      const opts = {
        openDelimiter: s.variablesOpenDelimiter,
        closeDelimiter: s.variablesCloseDelimiter,
        defaultSeparator: s.variablesDefaultSeparator,
        missingValueText: s.variablesMissingText,
        supportNesting: s.variablesSupportNesting,
        caseInsensitive: s.variablesCaseInsensitive,
        arrayJoinSeparator: s.variablesArrayJoinSeparator,
        preserveOnMissing: s.variablesPreserveOnMissing,
      };

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const { from, to } = view.state.selection.main;
      const selected = from === to
        ? view.state.doc.lineAt(from).text
        : view.state.sliceDoc(from, to);
      const replaced = replaceVariables(selected, frontmatter, opts);
      await navigator.clipboard.writeText(replaced);
      useToastStore.getState().addToast(t('common:selectionCopiedWithVariables'), 'success');
    };

    const handleReplaceSelection = async () => {
      const { enableVariables } = useSettingsStore.getState();
      if (!enableVariables) return;
      const view = useEditorStore.getState().editorViewRef.current;
      if (!view) return;

      const { extractFrontmatter, parseFrontmatter, replaceVariables } = await import('../lib/tidemark');
      const s = useSettingsStore.getState();
      const opts = {
        openDelimiter: s.variablesOpenDelimiter,
        closeDelimiter: s.variablesCloseDelimiter,
        defaultSeparator: s.variablesDefaultSeparator,
        missingValueText: s.variablesMissingText,
        supportNesting: s.variablesSupportNesting,
        caseInsensitive: s.variablesCaseInsensitive,
        arrayJoinSeparator: s.variablesArrayJoinSeparator,
        preserveOnMissing: s.variablesPreserveOnMissing,
      };

      const doc = view.state.doc.toString();
      const fm = extractFrontmatter(doc);
      const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
      const { from, to } = view.state.selection.main;
      if (from === to) return;
      const selected = view.state.sliceDoc(from, to);
      const replaced = replaceVariables(selected, frontmatter, opts);
      if (replaced !== selected) {
        view.dispatch({ changes: { from, to, insert: replaced } });
      }
    };

    window.addEventListener('cascade:variables-replace-all', handleReplaceAll);
    window.addEventListener('cascade:variables-copy-replaced', handleCopyReplaced);
    window.addEventListener('cascade:variables-set', handleSetVariable);
    window.addEventListener('cascade:variables-list', handleListVariables);
    window.addEventListener('cascade:variables-copy-line', handleCopyLineReplaced);
    window.addEventListener('cascade:variables-copy-selection', handleCopySelectionReplaced);
    window.addEventListener('cascade:variables-replace-selection', handleReplaceSelection);
    return () => {
      window.removeEventListener('cascade:variables-replace-all', handleReplaceAll);
      window.removeEventListener('cascade:variables-copy-replaced', handleCopyReplaced);
      window.removeEventListener('cascade:variables-set', handleSetVariable);
      window.removeEventListener('cascade:variables-list', handleListVariables);
      window.removeEventListener('cascade:variables-copy-line', handleCopyLineReplaced);
      window.removeEventListener('cascade:variables-copy-selection', handleCopySelectionReplaced);
      window.removeEventListener('cascade:variables-replace-selection', handleReplaceSelection);
    };
  }, []);

  const closeNewFileModal = useCallback(() => {
    setNewFileModalVisible(false);
  }, []);

  const handleCreateFile = useCallback((path: string) => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) return;
    useVaultStore.getState().createFile(path).then(() => {
      useEditorStore.getState().openFile(vaultPath, path);
    }).catch((err) => {
      console.error('Failed to create file:', path, err);
      const fileName = path.replace(/\\/g, '/').split('/').pop() ?? path;
      useToastStore.getState().addToast(t('common:failedToCreateFile', { fileName }), 'error');
    });
  }, []);

  const closeNewCanvasModal = useCallback(() => {
    setNewCanvasModalVisible(false);
  }, []);

  const handleCreateCanvas = useCallback((path: string) => {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) return;
    const canvasPath = path.endsWith('.canvas') ? path : `${path}.canvas`;
    useVaultStore.getState().createFile(canvasPath).then(() => {
      return writeFile(vaultPath, canvasPath, '{"nodes":[],"edges":[]}');
    }).then(() => {
      useEditorStore.getState().openFile(vaultPath, canvasPath);
    }).catch((err) => {
      console.error('Failed to create canvas:', canvasPath, err);
      const fileName = canvasPath.replace(/\\/g, '/').split('/').pop() ?? canvasPath;
      useToastStore.getState().addToast(t('common:failedToCreateFile', { fileName }), 'error');
    });
  }, []);

  // Listen for link-picker requests from the editor
  useEffect(() => {
    const unsub = quickOpenBus.subscribe((callback) => {
      setQuickOpenMode('link');
      // Wrap in a function so React doesn't call it as a state initializer
      setInsertLinkCallback(() => callback);
      setQuickOpenVisible(true);
    });
    return unsub;
  }, []);

  const handleClose = useCallback(() => {
    setQuickOpenVisible(false);
    setInsertLinkCallback(null);
  }, []);

  const handleSetVarSave = useCallback(async (value: string) => {
    if (!setVarModal) return;
    const view = useEditorStore.getState().editorViewRef.current;
    if (!view) return;

    const { updateFrontmatter } = await import('../lib/tidemark');
    const doc = view.state.doc.toString();
    const newDoc = updateFrontmatter(doc, setVarModal.name, value);
    if (newDoc !== doc) {
      view.dispatch({ changes: { from: 0, to: doc.length, insert: newDoc } });
      useToastStore.getState().addToast(t('common:setVariable', { name: setVarModal.name, value }), 'success');
    }
  }, [setVarModal]);

  const handleListVarSave = useCallback(async (name: string, value: string) => {
    const view = useEditorStore.getState().editorViewRef.current;
    if (!view) return;

    const { updateFrontmatter, extractFrontmatter, parseFrontmatter, scanDocumentVariables } = await import('../lib/tidemark');
    const doc = view.state.doc.toString();
    const newDoc = updateFrontmatter(doc, name, value);
    if (newDoc !== doc) {
      view.dispatch({ changes: { from: 0, to: doc.length, insert: newDoc } });
    }

    // Refresh the variables list with updated frontmatter
    const s = useSettingsStore.getState();
    const opts = {
      openDelimiter: s.variablesOpenDelimiter,
      closeDelimiter: s.variablesCloseDelimiter,
      defaultSeparator: s.variablesDefaultSeparator,
      missingValueText: s.variablesMissingText,
      supportNesting: s.variablesSupportNesting,
      caseInsensitive: s.variablesCaseInsensitive,
      arrayJoinSeparator: s.variablesArrayJoinSeparator,
      preserveOnMissing: s.variablesPreserveOnMissing,
    };
    const updatedDoc = view.state.doc.toString();
    const fm = extractFrontmatter(updatedDoc);
    const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
    const body = updatedDoc.slice(fm?.bodyStart ?? 0);
    setListVarsModal(scanDocumentVariables(body, frontmatter, opts));
    useToastStore.getState().addToast(t('common:setVariable', { name, value }), 'success');
  }, []);

  const focusModeActive = useEditorStore((s) => s.focusModeActive);

  const sidebarEl = (
    <div
      className={focusModeActive ? 'sidebar-collapsed' : ''}
      style={{ order: sidebarPosition === 'right' ? 2 : 0 }}
    >
      <ErrorBoundary name="sidebar">
        <Sidebar collapsed={!sidebarVisible} onToggle={toggleSidebar} />
      </ErrorBoundary>
    </div>
  );

  if (!vaultPath) {
    return (
      <>
        <TitleBar />
        <OnboardingScreen />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'var(--ctp-base)' }}>
      <TitleBar />
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        {sidebarEl}
        <div className="flex flex-col flex-1 min-w-0" style={{ order: 1 }}>
          <ErrorBoundary name="editor">
            <SplitPaneContainer />
          </ErrorBoundary>
        </div>
      </div>
      <QuickOpen
        open={quickOpenVisible}
        mode={quickOpenMode}
        onClose={handleClose}
        onInsertLink={insertLinkCallback ?? undefined}
      />
      <CommandPalette
        open={commandPaletteVisible}
        onClose={closeCommandPalette}
      />
      <ErrorBoundary name="search-modal">
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}><div className="rounded-xl p-8" style={{ backgroundColor: 'var(--ctp-base)', width: 500 }}><div className="w-6 h-6 mx-auto border-2 rounded-full animate-spin" style={{ borderColor: 'var(--ctp-surface2)', borderTopColor: 'var(--ctp-accent)' }} /></div></div>}>
          <SearchModal
            open={searchModalVisible}
            onClose={closeSearchModal}
          />
        </Suspense>
      </ErrorBoundary>
      <NewFileModal
        open={newFileModalVisible}
        onClose={closeNewFileModal}
        onCreate={handleCreateFile}
      />
      <NewFileModal
        open={newCanvasModalVisible}
        onClose={closeNewCanvasModal}
        onCreate={handleCreateCanvas}
      />
      <ErrorBoundary name="settings-modal">
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}><div className="rounded-xl p-8" style={{ backgroundColor: 'var(--ctp-base)', width: 500 }}><div className="w-6 h-6 mx-auto border-2 rounded-full animate-spin" style={{ borderColor: 'var(--ctp-surface2)', borderTopColor: 'var(--ctp-accent)' }} /></div></div>}>
          <SettingsModal
            open={settingsVisible}
            onClose={closeSettings}
          />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary name="export-modal">
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}><div className="rounded-xl p-8" style={{ backgroundColor: 'var(--ctp-base)', width: 500 }}><div className="w-6 h-6 mx-auto border-2 rounded-full animate-spin" style={{ borderColor: 'var(--ctp-surface2)', borderTopColor: 'var(--ctp-accent)' }} /></div></div>}>
          <ExportModal
            open={exportVisible}
            onClose={closeExport}
            defaultScope={exportDefaultScope}
          />
        </Suspense>
      </ErrorBoundary>
      <ListVariablesModal
        open={listVarsModal !== null}
        variables={listVarsModal ?? []}
        onClose={closeListVarsModal}
        onSave={handleListVarSave}
      />
      <ErrorBoundary name="import-modal">
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}><div className="rounded-xl p-8" style={{ backgroundColor: 'var(--ctp-base)', width: 500 }}><div className="w-6 h-6 mx-auto border-2 rounded-full animate-spin" style={{ borderColor: 'var(--ctp-surface2)', borderTopColor: 'var(--ctp-accent)' }} /></div></div>}>
          <ImportWizard
            open={importVisible}
            onClose={closeImport}
          />
        </Suspense>
      </ErrorBoundary>
      <AboutDialog open={aboutOpen} onClose={closeAbout} />
      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        kind={confirmDialog?.kind ?? 'info'}
        confirmLabel={confirmDialog?.confirmLabel ?? 'Confirm'}
        onConfirm={confirmDialog?.onConfirm ?? (() => {})}
        onCancel={closeConfirmDialog}
      />
      <ToastContainer />
      <FileConflictDialog />
      <SetVariableModal
        open={setVarModal !== null}
        variableName={setVarModal?.name ?? ''}
        currentValue={setVarModal?.currentValue ?? ''}
        onClose={closeSetVarModal}
        onSave={handleSetVarSave}
      />
    </div>
  );
}
