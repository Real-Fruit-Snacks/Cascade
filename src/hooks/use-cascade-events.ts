import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import type { ConfirmDialogState } from './use-modal-state';

export interface CascadeEventCallbacks {
  setSearchModalVisible: (visible: boolean) => void;
  setNewFileModalVisible: (visible: boolean) => void;
  setNewCanvasModalVisible: (visible: boolean) => void;
  setSettingsVisible: (visible: boolean) => void;
  setCommandPaletteVisible: (visible: boolean) => void;
  setExportVisible: (visible: boolean) => void;
  setExportDefaultScope: (scope: 'current' | 'vault') => void;
  setImportVisible: (visible: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void;
}

export function useCascadeEvents(callbacks: CascadeEventCallbacks): void {
  const { t } = useTranslation(['dialogs']);

  // Keep a ref so event handlers always call the latest callbacks without
  // re-registering listeners on every render.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const openSearch = () => {
      if (useSettingsStore.getState().enableSearch) callbacksRef.current.setSearchModalVisible(true);
    };
    const newFile = () => callbacksRef.current.setNewFileModalVisible(true);
    const newCanvas = () => callbacksRef.current.setNewCanvasModalVisible(true);
    const openSettings = () => callbacksRef.current.setSettingsVisible(true);
    const openCmdPalette = () => callbacksRef.current.setCommandPaletteVisible(true);
    const openExport = () => {
      callbacksRef.current.setExportDefaultScope('current');
      callbacksRef.current.setExportVisible(true);
    };
    const openBatchExport = () => {
      callbacksRef.current.setExportDefaultScope('vault');
      callbacksRef.current.setExportVisible(true);
    };
    const openImport = () => callbacksRef.current.setImportVisible(true);
    const openAbout = () => callbacksRef.current.setAboutOpen(true);
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
      callbacksRef.current.setConfirmDialog({
        title: t('dialogs:closeVault.title'),
        message: hasDirty
          ? t('dialogs:closeVault.messageDirty')
          : t('dialogs:closeVault.messageClean'),
        kind: hasDirty ? 'warning' : 'info',
        confirmLabel: t('dialogs:closeVault.confirmLabel'),
        onConfirm: () => {
          callbacksRef.current.setConfirmDialog(null);
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
  }, [t]);
}
