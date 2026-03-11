import { useCallback, useState } from 'react';
import type { QuickOpenMode } from '../components/QuickOpen';
import type { VariableMatch } from '../lib/tidemark';

const SIDEBAR_STORAGE_KEY = 'cascade-sidebar-visible';

export interface ConfirmDialogState {
  title: string;
  message: string;
  kind: 'info' | 'warning';
  confirmLabel: string;
  onConfirm: () => void;
}

export interface ModalState {
  quickOpenVisible: boolean;
  quickOpenMode: QuickOpenMode;
  insertLinkCallback: ((name: string) => void) | null;
  commandPaletteVisible: boolean;
  searchModalVisible: boolean;
  newFileModalVisible: boolean;
  newCanvasModalVisible: boolean;
  settingsVisible: boolean;
  exportVisible: boolean;
  exportDefaultScope: 'current' | 'vault';
  aboutOpen: boolean;
  importVisible: boolean;
  confirmDialog: ConfirmDialogState | null;
  sidebarVisible: boolean;
  setVarModal: { name: string; currentValue: string } | null;
  listVarsModal: VariableMatch[] | null;
}

export interface ModalCallbacks {
  openQuickOpen: () => void;
  setQuickOpenMode: (mode: QuickOpenMode) => void;
  setInsertLinkCallback: (cb: ((name: string) => void) | null) => void;
  setQuickOpenVisible: (visible: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setSearchModalVisible: (visible: boolean) => void;
  closeSearchModal: () => void;
  setNewFileModalVisible: (visible: boolean) => void;
  closeNewFileModal: () => void;
  setNewCanvasModalVisible: (visible: boolean) => void;
  closeNewCanvasModal: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setExportVisible: (visible: boolean) => void;
  setExportDefaultScope: (scope: 'current' | 'vault') => void;
  closeExport: () => void;
  closeAbout: () => void;
  setAboutOpen: (open: boolean) => void;
  setImportVisible: (visible: boolean) => void;
  closeImport: () => void;
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void;
  closeConfirmDialog: () => void;
  toggleSidebar: () => void;
  setSettingsVisible: (visible: boolean) => void;
  setCommandPaletteVisible: (visible: boolean) => void;
  setSetVarModal: (modal: { name: string; currentValue: string } | null) => void;
  closeSetVarModal: () => void;
  setListVarsModal: (vars: VariableMatch[] | null) => void;
  closeListVarsModal: () => void;
}

export function useModalState(): ModalState & ModalCallbacks {
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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });
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

  const closeNewFileModal = useCallback(() => {
    setNewFileModalVisible(false);
  }, []);

  const closeNewCanvasModal = useCallback(() => {
    setNewCanvasModalVisible(false);
  }, []);

  const closeImport = useCallback(() => setImportVisible(false), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const closeSetVarModal = useCallback(() => setSetVarModal(null), []);
  const closeListVarsModal = useCallback(() => setListVarsModal(null), []);
  const closeConfirmDialog = useCallback(() => setConfirmDialog(null), []);

  return {
    // State
    quickOpenVisible,
    quickOpenMode,
    insertLinkCallback,
    commandPaletteVisible,
    searchModalVisible,
    newFileModalVisible,
    newCanvasModalVisible,
    settingsVisible,
    exportVisible,
    exportDefaultScope,
    aboutOpen,
    importVisible,
    confirmDialog,
    sidebarVisible,
    setVarModal,
    listVarsModal,
    // Callbacks
    openQuickOpen,
    setQuickOpenMode,
    setInsertLinkCallback,
    setQuickOpenVisible,
    openCommandPalette,
    closeCommandPalette,
    setSearchModalVisible,
    closeSearchModal,
    setNewFileModalVisible,
    closeNewFileModal,
    setNewCanvasModalVisible,
    closeNewCanvasModal,
    openSettings,
    closeSettings,
    setExportVisible,
    setExportDefaultScope,
    closeExport,
    closeAbout,
    setAboutOpen,
    setImportVisible,
    closeImport,
    setConfirmDialog,
    closeConfirmDialog,
    toggleSidebar,
    setSettingsVisible,
    setCommandPaletteVisible,
    setSetVarModal,
    closeSetVarModal,
    setListVarsModal,
    closeListVarsModal,
  };
}
