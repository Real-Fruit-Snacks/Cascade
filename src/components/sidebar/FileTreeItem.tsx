import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilePlus, FolderPlus, LayoutGrid } from 'lucide-react';
import type { FileEntry } from '../../types/index';
import { useEditorStore } from '../../stores/editor-store';
import { useVaultStore } from '../../stores/vault-store';
import { ContextMenu } from './ContextMenu';
import { resolveStyleTargets, getParentDir, type TreeSettings } from './file-tree-types';
import { buildContextMenuItems } from './file-tree-context-menu';
import { FolderColorPicker } from './FolderColorPicker';
import { FileTreeModals } from './FileTreeModals';
import { FileTreeRow } from './FileTreeRow';
import type { TemplateSelection } from './TemplatePicker';
import {
  commitRenameAction,
  performDeleteAction,
  handleMoveConfirmAction,
  handleNewFileSubmitAction,
  handleNewFolderSubmitAction,
  handleNewCanvasSubmitAction,
  handleTemplateSelectAction,
} from './file-tree-actions';

export type { TreeSettings };

interface FileTreeItemProps {
  entry: FileEntry;
  depth?: number;
  isActive: boolean;
  isDirty: boolean;
  hasOpenTab: boolean;
  isExpanded: boolean;
  isFocused: boolean;
  isBookmarked: boolean;
  onToggleExpand: (path: string, expanded: boolean) => void;
  templateFiles?: FileEntry[];
  folderTemplates?: FileEntry[];
  ownColor?: string | null;
  inheritedColor?: string | null;
  onColorChange?: () => void;
  treeSettings: TreeSettings;
}

export const FileTreeItem = memo(function FileTreeItem({
  entry, depth = 0, isActive, isDirty, hasOpenTab, isExpanded, isFocused,
  isBookmarked, onToggleExpand, templateFiles = [], folderTemplates = [],
  ownColor = null, inheritedColor = null, onColorChange, treeSettings,
}: FileTreeItemProps) {
  const { t } = useTranslation('sidebar');

  const {
    confirmBeforeDelete, showFileExtensions, showFolderIcons, showFileIcons,
    enableFolderColors, folderColorSubfolders, folderColorFiles, folderColorStyle,
    folderColorFileStyle, folderColorBold, folderColorOpacity, folderColorIcon,
    folderColorName, folderColorBackground, folderColorChevron, folderColorFileIcon,
    folderColorFileName, folderColorFileBackground, enableBookmarks, useTrash, vaultPath,
  } = treeSettings;

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [pendingCreateType, setPendingCreateType] = useState<'file' | 'folder'>('file');
  const [dragOver, setDragOver] = useState(false);
  const [colorPicker, setColorPicker] = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [newFileModal, setNewFileModal] = useState(false);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newCanvasModal, setNewCanvasModal] = useState(false);

  const renameRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const isCommittingRename = useRef(false);

  const effectiveColor = enableFolderColors ? (ownColor || (folderColorSubfolders ? inheritedColor : null)) : null;
  const fileColor = enableFolderColors && folderColorFiles ? inheritedColor : null;
  const color = entry.isDir ? effectiveColor : fileColor;
  const style = entry.isDir ? folderColorStyle : folderColorFileStyle;
  const targets = color ? resolveStyleTargets(style, entry.isDir
    ? { icon: folderColorIcon, name: folderColorName, bg: folderColorBackground, chevron: folderColorChevron }
    : { icon: folderColorFileIcon, name: folderColorFileName, bg: folderColorFileBackground }
  ) : null;

  const openFile = useEditorStore.getState().openFile;
  const deleteFile = useVaultStore.getState().deleteFile;
  const renameFile = useVaultStore.getState().renameFile;
  const createFile = useVaultStore.getState().createFile;
  const createFolder = useVaultStore.getState().createFolder;
  const moveFile = useVaultStore.getState().moveFile;
  const getFolders = useVaultStore.getState().getFolders;

  const paddingLeft = 8 + depth * 16;

  const handleClick = (e: React.MouseEvent) => {
    if (renaming) return;
    if (entry.isDir) {
      onToggleExpand(entry.path, !isExpanded);
    } else if (vaultPath) {
      openFile(vaultPath, entry.path, e.ctrlKey || e.metaKey);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const startRename = () => {
    setRenaming(true);
    setRenameValue(entry.name);
    setTimeout(() => {
      const input = renameRef.current;
      if (input) {
        input.focus();
        if (!entry.isDir) {
          const dotIndex = entry.name.lastIndexOf('.');
          input.setSelectionRange(0, dotIndex > 0 ? dotIndex : entry.name.length);
        } else {
          input.select();
        }
      }
    }, 0);
  };

  const commitRename = async () => {
    if (isCommittingRename.current) return;
    isCommittingRename.current = true;
    try {
      await commitRenameAction({ entry, renameValue, vaultPath, renameFile, openFile, setRenaming, setRenameError, t });
    } finally {
      isCommittingRename.current = false;
    }
  };

  const performDelete = useCallback(async () => {
    await performDeleteAction({ entry, deleteFile, setDeleteConfirmOpen });
  }, [entry, deleteFile]);

  const handleDelete = useCallback(() => {
    if (confirmBeforeDelete) setDeleteConfirmOpen(true);
    else performDelete();
  }, [confirmBeforeDelete, performDelete]);

  const handleNewFileSubmit = useCallback(async (name: string) => {
    await handleNewFileSubmitAction(name, {
      entry, vaultPath, templateFiles, createFile, openFile, onToggleExpand,
      setNewFileModal, setPendingFilePath, setPendingCreateType, setTemplatePickerOpen,
    });
  }, [entry, vaultPath, templateFiles, createFile, openFile, onToggleExpand]);

  const handleNewFolderSubmit = useCallback(async (name: string) => {
    await handleNewFolderSubmitAction(name, {
      entry, folderTemplates, createFolder, onToggleExpand,
      setNewFolderModal, setPendingFilePath, setPendingCreateType, setTemplatePickerOpen,
    });
  }, [entry, folderTemplates, createFolder, onToggleExpand]);

  const handleNewCanvasSubmit = useCallback(async (name: string) => {
    await handleNewCanvasSubmitAction(name, { entry, vaultPath, createFile, openFile, onToggleExpand, setNewCanvasModal });
  }, [entry, vaultPath, createFile, openFile, onToggleExpand]);

  const handleMoveConfirm = useCallback(async (target: string) => {
    await handleMoveConfirmAction(target, { entry, vaultPath, moveFile, openFile, setMoveModalOpen });
  }, [entry, vaultPath, moveFile, openFile]);

  const handleTemplateSelect = useCallback(async (selection: TemplateSelection | null) => {
    await handleTemplateSelectAction(selection, {
      vaultPath, pendingFilePath, pendingCreateType, createFile, createFolder,
      openFile, setTemplatePickerOpen, setPendingFilePath, t,
    });
  }, [vaultPath, pendingFilePath, pendingCreateType, createFile, createFolder, openFile, t]);

  const menuItems = buildContextMenuItems({
    entry, isBookmarked, enableBookmarks, enableFolderColors, vaultPath, menu, useTrash, t,
    startRename, handleDelete,
    setNewFileModal, setNewFolderModal, setNewCanvasModal,
    setMoveModalOpen, setColorPickerPos, setColorPicker,
  });

  return (
    <div>
      <FileTreeRow
        entry={entry}
        rowRef={rowRef}
        isActive={isActive}
        isDirty={isDirty}
        hasOpenTab={hasOpenTab}
        isExpanded={isExpanded}
        isFocused={isFocused}
        dragOver={dragOver}
        renaming={renaming}
        renameValue={renameValue}
        renameError={renameError}
        renameRef={renameRef}
        paddingLeft={paddingLeft}
        color={color}
        targets={targets}
        effectiveColor={effectiveColor}
        folderColorOpacity={folderColorOpacity}
        folderColorBold={folderColorBold}
        showFolderIcons={showFolderIcons}
        showFileIcons={showFileIcons}
        showFileExtensions={showFileExtensions}
        vaultPath={vaultPath}
        moveFile={moveFile}
        openFile={openFile}
        onToggleExpand={onToggleExpand}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        setDragOver={setDragOver}
        setRenameValue={setRenameValue}
        setRenameError={setRenameError}
        setRenaming={setRenaming}
        commitRename={commitRename}
      />

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {colorPicker && (
        <FolderColorPicker
          entryPath={entry.path}
          folderColor={ownColor}
          enableFolderColors={enableFolderColors}
          pos={colorPickerPos}
          onClose={() => setColorPicker(false)}
          onColorChange={onColorChange}
          setMenu={setMenu}
        />
      )}

      <FileTreeModals
        entry={entry}
        useTrash={useTrash}
        templateFiles={templateFiles}
        folderTemplates={folderTemplates}
        pendingCreateType={pendingCreateType}
        folders={getFolders()}
        currentDir={getParentDir(entry.path)}
        newFileModal={newFileModal}
        newFolderModal={newFolderModal}
        newCanvasModal={newCanvasModal}
        moveModalOpen={moveModalOpen}
        templatePickerOpen={templatePickerOpen}
        deleteConfirmOpen={deleteConfirmOpen}
        onNewFileClose={() => setNewFileModal(false)}
        onNewFolderClose={() => setNewFolderModal(false)}
        onNewCanvasClose={() => setNewCanvasModal(false)}
        onMoveClose={() => setMoveModalOpen(false)}
        onTemplatePickerClose={() => { setTemplatePickerOpen(false); setPendingFilePath(null); }}
        onDeleteCancel={() => setDeleteConfirmOpen(false)}
        onNewFileSubmit={handleNewFileSubmit}
        onNewFolderSubmit={handleNewFolderSubmit}
        onNewCanvasSubmit={handleNewCanvasSubmit}
        onMoveConfirm={handleMoveConfirm}
        onTemplateSelect={handleTemplateSelect}
        onDeleteConfirm={performDelete}
      />
    </div>
  );
});

// Re-export icon components used by consumers importing from this module
export { FilePlus, FolderPlus, LayoutGrid };
