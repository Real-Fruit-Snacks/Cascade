import type { FileEntry } from '../../types/index';
import { useEditorStore } from '../../stores/editor-store';
import { useToastStore } from '../../stores/toast-store';
import { readFile, writeFile, copyTemplateFolder } from '../../lib/tauri-commands';
import { applyTemplateVariables } from '../../lib/template-utils';
import { getParentDir } from './file-tree-types';
import type { TemplateSelection } from './TemplatePicker';

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

export interface CommitRenameArgs {
  entry: FileEntry;
  renameValue: string;
  vaultPath: string | null | undefined;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  openFile: (vaultPath: string, filePath: string, newTab?: boolean) => Promise<void>;
  setRenaming: (v: boolean) => void;
  setRenameError: (v: string | null) => void;
  t: (key: string) => string;
}

export async function commitRenameAction(args: CommitRenameArgs): Promise<void> {
  const { entry, renameValue, vaultPath, renameFile, openFile, setRenaming, setRenameError, t } = args;
  const newName = renameValue.trim();
  if (!newName || newName === entry.name) {
    setRenaming(false);
    setRenameError(null);
    return;
  }

  const parentDir = getParentDir(entry.path);
  const newPath = parentDir ? `${parentDir}/${newName}` : newName;

  try {
    const wasActive = useEditorStore.getState().activeFilePath === entry.path;
    await renameFile(entry.path, newPath);
    setRenaming(false);
    setRenameError(null);

    const store = useEditorStore.getState();
    const tabIndex = store.tabs.findIndex((tab) => tab.path === entry.path);
    if (tabIndex !== -1 && vaultPath) {
      store.closeTab(tabIndex, true);
      await openFile(vaultPath, newPath);
    } else if (wasActive && vaultPath) {
      await openFile(vaultPath, newPath);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setRenameError(msg.includes('already exists') ? t('rename.alreadyExists') : `${t('common:rename')} failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export interface PerformDeleteArgs {
  entry: FileEntry;
  deleteFile: (path: string) => Promise<void>;
  setDeleteConfirmOpen: (v: boolean) => void;
}

export async function performDeleteAction(args: PerformDeleteArgs): Promise<void> {
  const { entry, deleteFile, setDeleteConfirmOpen } = args;
  setDeleteConfirmOpen(false);
  const store = useEditorStore.getState();
  const normalizedEntry = entry.path.replace(/\\/g, '/');
  for (let i = store.tabs.length - 1; i >= 0; i--) {
    const tabPath = store.tabs[i].path.replace(/\\/g, '/');
    if (tabPath === normalizedEntry || (entry.isDir && tabPath.startsWith(normalizedEntry + '/'))) {
      store.closeTab(i, true);
    }
  }
  await deleteFile(entry.path);
}

// ---------------------------------------------------------------------------
// Move confirm
// ---------------------------------------------------------------------------

export interface HandleMoveConfirmArgs {
  entry: FileEntry;
  vaultPath: string | null | undefined;
  moveFile: (path: string, target: string) => Promise<string | null | undefined>;
  openFile: (vaultPath: string, filePath: string, newTab?: boolean) => Promise<void>;
  setMoveModalOpen: (v: boolean) => void;
}

export async function handleMoveConfirmAction(target: string, args: HandleMoveConfirmArgs): Promise<void> {
  const { entry, vaultPath, moveFile, openFile, setMoveModalOpen } = args;
  setMoveModalOpen(false);
  const wasActive = useEditorStore.getState().activeFilePath === entry.path;
  const newPath = await moveFile(entry.path, target);
  if (newPath && wasActive && vaultPath) {
    const store = useEditorStore.getState();
    const tabIndex = store.tabs.findIndex((tab) => tab.path === entry.path);
    if (tabIndex !== -1) {
      store.closeTab(tabIndex, true);
    }
    await openFile(vaultPath, newPath);
  }
}

// ---------------------------------------------------------------------------
// New file
// ---------------------------------------------------------------------------

export interface HandleNewFileSubmitArgs {
  entry: FileEntry;
  vaultPath: string | null | undefined;
  templateFiles: FileEntry[];
  createFile: (path: string) => Promise<void>;
  openFile: (vaultPath: string, filePath: string, newTab?: boolean) => Promise<void>;
  onToggleExpand: (path: string, expanded: boolean) => void;
  setNewFileModal: (v: boolean) => void;
  setPendingFilePath: (v: string | null) => void;
  setPendingCreateType: (v: 'file' | 'folder') => void;
  setTemplatePickerOpen: (v: boolean) => void;
}

export async function handleNewFileSubmitAction(name: string, args: HandleNewFileSubmitArgs): Promise<void> {
  const { entry, vaultPath, templateFiles, createFile, openFile, onToggleExpand,
          setNewFileModal, setPendingFilePath, setPendingCreateType, setTemplatePickerOpen } = args;
  setNewFileModal(false);
  const dir = entry.isDir ? entry.path : getParentDir(entry.path);
  const fileName = name.endsWith('.md') ? name : `${name}.md`;
  const fullPath = dir ? `${dir}/${fileName}` : fileName;

  if (templateFiles.length > 0) {
    setPendingFilePath(fullPath);
    setPendingCreateType('file');
    setTemplatePickerOpen(true);
  } else {
    await createFile(fullPath);
    if (vaultPath) await openFile(vaultPath, fullPath);
  }

  if (entry.isDir) {
    onToggleExpand(entry.path, true);
  }
}

// ---------------------------------------------------------------------------
// New folder
// ---------------------------------------------------------------------------

export interface HandleNewFolderSubmitArgs {
  entry: FileEntry;
  folderTemplates: FileEntry[];
  createFolder: (path: string) => Promise<void>;
  onToggleExpand: (path: string, expanded: boolean) => void;
  setNewFolderModal: (v: boolean) => void;
  setPendingFilePath: (v: string | null) => void;
  setPendingCreateType: (v: 'file' | 'folder') => void;
  setTemplatePickerOpen: (v: boolean) => void;
}

export async function handleNewFolderSubmitAction(name: string, args: HandleNewFolderSubmitArgs): Promise<void> {
  const { entry, folderTemplates, createFolder, onToggleExpand,
          setNewFolderModal, setPendingFilePath, setPendingCreateType, setTemplatePickerOpen } = args;
  setNewFolderModal(false);
  const dir = entry.isDir ? entry.path : getParentDir(entry.path);
  const fullPath = dir ? `${dir}/${name}` : name;

  if (folderTemplates.length > 0) {
    setPendingFilePath(fullPath);
    setPendingCreateType('folder');
    setTemplatePickerOpen(true);
  } else {
    await createFolder(fullPath);
  }

  if (entry.isDir) {
    onToggleExpand(entry.path, true);
  }
}

// ---------------------------------------------------------------------------
// New canvas
// ---------------------------------------------------------------------------

export interface HandleNewCanvasSubmitArgs {
  entry: FileEntry;
  vaultPath: string | null | undefined;
  createFile: (path: string) => Promise<void>;
  openFile: (vaultPath: string, filePath: string, newTab?: boolean) => Promise<void>;
  onToggleExpand: (path: string, expanded: boolean) => void;
  setNewCanvasModal: (v: boolean) => void;
}

export async function handleNewCanvasSubmitAction(name: string, args: HandleNewCanvasSubmitArgs): Promise<void> {
  const { entry, vaultPath, createFile, openFile, onToggleExpand, setNewCanvasModal } = args;
  setNewCanvasModal(false);
  const dir = entry.isDir ? entry.path : getParentDir(entry.path);
  const fileName = name.endsWith('.canvas') ? name : `${name}.canvas`;
  const fullPath = dir ? `${dir}/${fileName}` : fileName;
  await createFile(fullPath);
  if (vaultPath) {
    await writeFile(vaultPath, fullPath, '{"nodes":[],"edges":[]}');
    await openFile(vaultPath, fullPath);
  }
  if (entry.isDir) {
    onToggleExpand(entry.path, true);
  }
}

// ---------------------------------------------------------------------------
// Template select
// ---------------------------------------------------------------------------

export interface HandleTemplateSelectArgs {
  vaultPath: string | null | undefined;
  pendingFilePath: string | null;
  pendingCreateType: 'file' | 'folder';
  createFile: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  openFile: (vaultPath: string, filePath: string, newTab?: boolean) => Promise<void>;
  setTemplatePickerOpen: (v: boolean) => void;
  setPendingFilePath: (v: string | null) => void;
  t: (key: string) => string;
}

export async function handleTemplateSelectAction(
  selection: TemplateSelection | null,
  args: HandleTemplateSelectArgs,
): Promise<void> {
  const { vaultPath, pendingFilePath, pendingCreateType, createFile, createFolder,
          openFile, setTemplatePickerOpen, setPendingFilePath, t } = args;
  setTemplatePickerOpen(false);
  if (!vaultPath || !pendingFilePath) return;
  const filePath = pendingFilePath;
  const createType = pendingCreateType;
  setPendingFilePath(null);

  // Folder creation flow
  if (createType === 'folder') {
    if (selection?.type === 'folder') {
      try {
        const createdFiles = await copyTemplateFolder(vaultPath, selection.path, filePath);
        let clipboard = '';
        try { clipboard = await navigator.clipboard.readText(); } catch { /* clipboard unavailable */ }
        for (const fp of createdFiles) {
          if (fp.toLowerCase().endsWith('.md')) {
            try {
              const raw = await readFile(vaultPath, fp);
              const { text } = await applyTemplateVariables(raw, fp, clipboard);
              await writeFile(vaultPath, fp, text);
            } catch { /* skip files that fail substitution */ }
          }
        }
        const firstMd = createdFiles.find(f => f.toLowerCase().endsWith('.md'));
        if (firstMd) {
          await openFile(vaultPath, firstMd);
        }
      } catch {
        useToastStore.getState().addToast(t('toast.failedFolderTemplate'), 'error');
        await createFolder(filePath);
      }
    } else {
      await createFolder(filePath);
    }
    return;
  }

  // File creation flow
  if (selection?.type === 'file') {
    try {
      const raw = await readFile(vaultPath, selection.path);
      let clipboard = '';
      try { clipboard = await navigator.clipboard.readText(); } catch { /* clipboard unavailable */ }
      const { text } = await applyTemplateVariables(raw, filePath, clipboard);
      await createFile(filePath);
      await writeFile(vaultPath, filePath, text);
    } catch {
      useToastStore.getState().addToast(t('toast.failedTemplate'), 'error');
      await createFile(filePath);
    }
    await openFile(vaultPath, filePath);
  } else {
    await createFile(filePath);
    await openFile(vaultPath, filePath);
  }
}
