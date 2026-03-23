import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TitleBar } from './TitleBar';
import { Sidebar } from './sidebar/Sidebar';
import { SplitPaneContainer } from './SplitPaneContainer';
import { ErrorBoundary } from './ErrorBoundary';
import { QuickOpen } from './quick-open';
import { CommandPalette } from './CommandPalette';
import { NewFileModal } from './NewFileModal';
import { SetVariableModal } from './SetVariableModal';
import { ListVariablesModal } from './ListVariablesModal';

const SearchModal = lazy(() => import('./search').then((m) => ({ default: m.SearchModal })));
const SettingsModal = lazy(() => import('./SettingsModal').then((m) => ({ default: m.SettingsModal })));
const ExportModal = lazy(() => import('./ExportModal').then((m) => ({ default: m.ExportModal })));
const ImportWizard = lazy(() => import('./ImportWizard').then((m) => ({ default: m.ImportWizard })));
import { OnboardingScreen } from './OnboardingScreen';
import { AboutDialog } from './AboutDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { ConfirmDialogProvider } from './ConfirmDialogProvider';
import { ToastContainer } from './ToastContainer';
import { FileConflictDialog } from './FileConflictDialog';
import { useToastStore } from '../stores/toast-store';
import { quickOpenBus } from '../lib/quick-open-bus';
import { useCommands } from '../hooks/use-commands';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import { writeFile } from '../lib/tauri-commands';
import { useSyncTimer } from '../hooks/use-sync-timer';

import { useModalState } from '../hooks/use-modal-state';
import { useCascadeEvents } from '../hooks/use-cascade-events';
import type { CascadeEventCallbacks } from '../hooks/use-cascade-events';
import { useVariablesFeature } from '../hooks/use-variables-feature';
import type { VariablesFeatureCallbacks } from '../hooks/use-variables-feature';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { useGlobalDragDrop } from '../hooks/use-global-drag-drop';
import { useThemeSetup } from '../hooks/use-theme-setup';
import { ThemeStudioToolbar } from './theme-studio/ThemeStudioToolbar';
import { createLogger } from '../lib/logger';
import { getVersion } from '@tauri-apps/api/app';
import { checkForUpdate, isNewVersion, markVersionSeen, fetchReleaseNotes } from '../lib/update-checker';
import { openUrl } from '@tauri-apps/plugin-opener';
import { WhatsNewDialog } from './WhatsNewDialog';

const log = createLogger('AppShell');

export function AppShell() {
  const { t } = useTranslation(['common', 'dialogs']);
  useSyncTimer();
  useThemeSetup();
  useKeyboardShortcuts();
  useGlobalDragDrop();

  const sidebarPosition = useSettingsStore((s) => s.sidebarPosition);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  // "What's New" dialog state
  const [whatsNew, setWhatsNew] = useState<{ version: string; notes: string } | null>(null);

  const modal = useModalState();

  useCommands({
    openCommandPalette: modal.openCommandPalette,
    openQuickOpen: modal.openQuickOpen,
    toggleSidebar: modal.toggleSidebar,
    openSettings: modal.openSettings,
  });

  // Suppress the default browser context menu globally
  useEffect(() => {
    const suppress = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', suppress);
    return () => document.removeEventListener('contextmenu', suppress);
  }, []);

  // Check for updates on launch
  useEffect(() => {
    const checkUpdates = useSettingsStore.getState().checkForUpdates;
    if (!checkUpdates) return;

    checkForUpdate().then((update) => {
      if (update) {
        useToastStore.getState().addToast(
          t('common:update.available', { version: update.version }),
          'info',
          15000,
          {
            label: t('common:update.download'),
            action: () => {
              openUrl(update.url).catch(() => window.open(update.url, '_blank', 'noopener'));
            },
          },
        );
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show "What's New" dialog on first launch after update
  useEffect(() => {
    getVersion().then(async (currentVersion) => {
      if (isNewVersion(currentVersion)) {
        const notes = await fetchReleaseNotes(currentVersion);
        if (notes) {
          setWhatsNew({ version: currentVersion, notes });
        }
      }
      markVersionSeen(currentVersion);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Intercept Tauri window close (Alt+F4, taskbar close, system close)
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      if (useEditorStore.getState().hasDirtyTabs()) {
        event.preventDefault();
        modal.setConfirmDialog({
          title: t('dialogs:unsavedChanges.title'),
          message: t('dialogs:unsavedChanges.message'),
          kind: 'warning',
          confirmLabel: t('dialogs:unsavedChanges.confirmLabel'),
          onConfirm: () => {
            modal.setConfirmDialog(null);
            appWindow.destroy();
          },
        });
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [t, modal.setConfirmDialog]);

  // Stable callback objects for event hooks (avoid re-registering listeners on every render)
  const cascadeEventCallbacks = useMemo<CascadeEventCallbacks>(() => ({
    setSearchModalVisible: modal.setSearchModalVisible,
    setNewFileModalVisible: modal.setNewFileModalVisible,
    setNewCanvasModalVisible: modal.setNewCanvasModalVisible,
    setSettingsVisible: modal.setSettingsVisible,
    setCommandPaletteVisible: modal.setCommandPaletteVisible,
    setExportVisible: modal.setExportVisible,
    setExportDefaultScope: modal.setExportDefaultScope,
    setImportVisible: modal.setImportVisible,
    setAboutOpen: modal.setAboutOpen,
    setConfirmDialog: modal.setConfirmDialog,
  }), [
    modal.setSearchModalVisible,
    modal.setNewFileModalVisible,
    modal.setNewCanvasModalVisible,
    modal.setSettingsVisible,
    modal.setCommandPaletteVisible,
    modal.setExportVisible,
    modal.setExportDefaultScope,
    modal.setImportVisible,
    modal.setAboutOpen,
    modal.setConfirmDialog,
  ]);

  useCascadeEvents(cascadeEventCallbacks);

  const variablesCallbacks = useMemo<VariablesFeatureCallbacks>(() => ({
    setSetVarModal: modal.setSetVarModal,
    setListVarsModal: modal.setListVarsModal,
  }), [modal.setSetVarModal, modal.setListVarsModal]);

  useVariablesFeature(variablesCallbacks);

  // File/canvas creation handlers
  const handleCreateFile = useCallback((path: string) => {
    const vp = useVaultStore.getState().vaultPath;
    if (!vp) return;
    useVaultStore.getState().createFile(path).then(() => {
      useEditorStore.getState().openFile(vp, path);
    }).catch((err) => {
      log.error('Failed to create file:', path, err);
      const fileName = path.replace(/\\/g, '/').split('/').pop() ?? path;
      useToastStore.getState().addToast(t('common:failedToCreateFile', { fileName }), 'error');
    });
  }, [t]);

  const handleCreateCanvas = useCallback((path: string) => {
    const vp = useVaultStore.getState().vaultPath;
    if (!vp) return;
    const canvasPath = path.endsWith('.canvas') ? path : `${path}.canvas`;
    useVaultStore.getState().createFile(canvasPath).then(() => {
      return writeFile(vp, canvasPath, '{"nodes":[],"edges":[]}');
    }).then(() => {
      useEditorStore.getState().openFile(vp, canvasPath);
    }).catch((err) => {
      log.error('Failed to create canvas:', canvasPath, err);
      const fileName = canvasPath.replace(/\\/g, '/').split('/').pop() ?? canvasPath;
      useToastStore.getState().addToast(t('common:failedToCreateFile', { fileName }), 'error');
    });
  }, [t]);

  // Listen for link-picker requests from the editor
  useEffect(() => {
    const unsub = quickOpenBus.subscribe((callback) => {
      modal.setQuickOpenMode('link');
      // Wrap in a function so React doesn't call it as a state initializer
      modal.setInsertLinkCallback(() => callback);
      modal.setQuickOpenVisible(true);
    });
    return unsub;
  }, [modal.setQuickOpenMode, modal.setInsertLinkCallback, modal.setQuickOpenVisible]);

  const handleQuickOpenClose = useCallback(() => {
    modal.setQuickOpenVisible(false);
    modal.setInsertLinkCallback(null);
  }, [modal.setQuickOpenVisible, modal.setInsertLinkCallback]);

  // Variable modal save handlers
  const handleSetVarSave = useCallback(async (value: string) => {
    if (!modal.setVarModal) return;
    const view = useEditorStore.getState().editorViewRef.current;
    if (!view) return;

    const { updateFrontmatter } = await import('../lib/tidemark');
    const doc = view.state.doc.toString();
    const newDoc = updateFrontmatter(doc, modal.setVarModal.name, value);
    if (newDoc !== doc) {
      view.dispatch({ changes: { from: 0, to: doc.length, insert: newDoc } });
      useToastStore.getState().addToast(t('common:setVariable', { name: modal.setVarModal.name, value }), 'success');
    }
  }, [modal.setVarModal, t]);

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
    modal.setListVarsModal(scanDocumentVariables(body, frontmatter, opts));
    useToastStore.getState().addToast(t('common:setVariable', { name, value }), 'success');
  }, [t, modal.setListVarsModal]);

  const focusModeActive = useEditorStore((s) => s.focusModeActive);

  const sidebarEl = (
    <div
      className={focusModeActive ? 'sidebar-collapsed' : ''}
      style={{ order: sidebarPosition === 'right' ? 2 : 0 }}
    >
      <ErrorBoundary name="sidebar">
        <Sidebar collapsed={!modal.sidebarVisible} onToggle={modal.toggleSidebar} />
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

  const suspenseFallback = (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--ctp-base)' }}>
      <div className="flex flex-col items-center gap-4">
        <img src="/app-icon.png" alt="Cascade" style={{ width: 72, height: 72, opacity: 0.7 }} draggable={false} />
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--ctp-surface2)', borderTopColor: 'var(--ctp-accent)' }} />
      </div>
    </div>
  );

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
        open={modal.quickOpenVisible}
        mode={modal.quickOpenMode}
        onClose={handleQuickOpenClose}
        onInsertLink={modal.insertLinkCallback ?? undefined}
      />
      <CommandPalette
        open={modal.commandPaletteVisible}
        onClose={modal.closeCommandPalette}
      />
      <ErrorBoundary name="search-modal">
        <Suspense fallback={suspenseFallback}>
          <SearchModal
            open={modal.searchModalVisible}
            onClose={modal.closeSearchModal}
          />
        </Suspense>
      </ErrorBoundary>
      <NewFileModal
        open={modal.newFileModalVisible}
        onClose={modal.closeNewFileModal}
        onCreate={handleCreateFile}
      />
      <NewFileModal
        open={modal.newCanvasModalVisible}
        onClose={modal.closeNewCanvasModal}
        onCreate={handleCreateCanvas}
      />
      <ErrorBoundary name="settings-modal">
        <Suspense fallback={suspenseFallback}>
          <SettingsModal
            open={modal.settingsVisible}
            onClose={modal.closeSettings}
          />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary name="export-modal">
        <Suspense fallback={suspenseFallback}>
          <ExportModal
            open={modal.exportVisible}
            onClose={modal.closeExport}
            defaultScope={modal.exportDefaultScope}
          />
        </Suspense>
      </ErrorBoundary>
      <ListVariablesModal
        open={modal.listVarsModal !== null}
        variables={modal.listVarsModal ?? []}
        onClose={modal.closeListVarsModal}
        onSave={handleListVarSave}
      />
      <ErrorBoundary name="import-modal">
        <Suspense fallback={suspenseFallback}>
          <ImportWizard
            open={modal.importVisible}
            onClose={modal.closeImport}
          />
        </Suspense>
      </ErrorBoundary>
      <AboutDialog open={modal.aboutOpen} onClose={modal.closeAbout} />
      <WhatsNewDialog
        open={whatsNew !== null}
        onClose={() => setWhatsNew(null)}
        version={whatsNew?.version ?? ''}
        releaseNotes={whatsNew?.notes ?? ''}
      />
      <ConfirmDialog
        open={modal.confirmDialog !== null}
        title={modal.confirmDialog?.title ?? ''}
        message={modal.confirmDialog?.message ?? ''}
        kind={modal.confirmDialog?.kind ?? 'info'}
        confirmLabel={modal.confirmDialog?.confirmLabel ?? 'Confirm'}
        onConfirm={modal.confirmDialog?.onConfirm ?? (() => {})}
        onCancel={modal.closeConfirmDialog}
      />
      <ConfirmDialogProvider />
      <ToastContainer />
      <FileConflictDialog />
      <SetVariableModal
        open={modal.setVarModal !== null}
        variableName={modal.setVarModal?.name ?? ''}
        currentValue={modal.setVarModal?.currentValue ?? ''}
        onClose={modal.closeSetVarModal}
        onSave={handleSetVarSave}
      />
      <ThemeStudioToolbar />
    </div>
  );
}
