import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { File, FilePlus, Folder, FolderOpen, FolderPlus, FolderInput, ChevronRight, Pencil, Trash2, Palette, Star, Copy, ExternalLink, LayoutGrid } from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { ConfirmDialog } from '../ConfirmDialog';
import type { FileEntry } from '../../types/index';
import { useEditorStore } from '../../stores/editor-store';
import { useVaultStore } from '../../stores/vault-store';
import { useSettingsStore } from '../../stores/settings-store';
import { ContextMenu } from './ContextMenu';
import type { MenuItem } from './ContextMenu';
import { MoveFileModal } from './MoveFileModal';
import { InputModal } from './InputModal';
import { TemplatePicker, type TemplateSelection } from './TemplatePicker';
import { readFile, writeFile, copyTemplateFolder } from '../../lib/tauri-commands';
import { applyTemplateVariables } from '../../lib/template-utils';
import { useToastStore } from '../../stores/toast-store';
import { usePluginStore } from '../../stores/plugin-store';

const FOLDER_COLOR_KEY = 'cascade-folder-colors';
const FOLDER_PALETTE = [
  { name: 'Blue', cssVar: 'var(--ctp-blue)' },
  { name: 'Mauve', cssVar: 'var(--ctp-mauve)' },
  { name: 'Pink', cssVar: 'var(--ctp-pink)' },
  { name: 'Red', cssVar: 'var(--ctp-red)' },
  { name: 'Peach', cssVar: 'var(--ctp-peach)' },
  { name: 'Yellow', cssVar: 'var(--ctp-yellow)' },
  { name: 'Green', cssVar: 'var(--ctp-green)' },
  { name: 'Teal', cssVar: 'var(--ctp-teal)' },
  { name: 'Sky', cssVar: 'var(--ctp-sky)' },
  { name: 'Lavender', cssVar: 'var(--ctp-lavender)' },
  { name: 'Flamingo', cssVar: 'var(--ctp-flamingo)' },
  { name: 'Rosewater', cssVar: 'var(--ctp-rosewater)' },
];

function getFolderColors(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FOLDER_COLOR_KEY) || '{}');
  } catch { return {}; }
}

function setFolderColor(path: string, cssVar: string | null) {
  const colors = getFolderColors();
  if (cssVar) {
    colors[path] = cssVar;
  } else {
    delete colors[path];
  }
  localStorage.setItem(FOLDER_COLOR_KEY, JSON.stringify(colors));
}

export interface TreeSettings {
  confirmBeforeDelete: boolean;
  showFileExtensions: boolean;
  showFolderIcons: boolean;
  showFileIcons: boolean;
  enableFolderColors: boolean;
  folderColorSubfolders: boolean;
  folderColorFiles: boolean;
  folderColorStyle: string;
  folderColorFileStyle: string;
  folderColorBold: boolean;
  folderColorOpacity: number;
  folderColorIcon: boolean;
  folderColorName: boolean;
  folderColorBackground: boolean;
  folderColorChevron: boolean;
  folderColorFileIcon: boolean;
  folderColorFileName: boolean;
  folderColorFileBackground: boolean;
  enableBookmarks: boolean;
  useTrash: boolean;
  vaultPath: string | null;
}

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
  inheritedColor?: string | null;
  onColorChange?: () => void;
  treeSettings: TreeSettings;
}

interface StyleTargets {
  icon: boolean;
  name: boolean;
  bg: boolean;
  chevron: boolean;
  dot: boolean;
  accentBar: boolean;
}

function resolveStyleTargets(
  style: string,
  custom: { icon: boolean; name: boolean; bg: boolean; chevron?: boolean },
): StyleTargets {
  switch (style) {
    case 'icon-only': return { icon: true, name: false, bg: false, chevron: false, dot: false, accentBar: false };
    case 'text': return { icon: true, name: true, bg: false, chevron: false, dot: false, accentBar: false };
    case 'background': return { icon: true, name: false, bg: true, chevron: false, dot: false, accentBar: false };
    case 'accent-bar': return { icon: true, name: false, bg: false, chevron: false, dot: false, accentBar: true };
    case 'full': return { icon: true, name: true, bg: true, chevron: false, dot: false, accentBar: false };
    case 'dot': return { icon: false, name: false, bg: false, chevron: false, dot: true, accentBar: false };
    case 'custom': return { icon: custom.icon, name: custom.name, bg: custom.bg, chevron: custom.chevron ?? false, dot: false, accentBar: false };
    default: return { icon: true, name: false, bg: false, chevron: false, dot: false, accentBar: false };
  }
}

function getParentDir(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const i = normalized.lastIndexOf('/');
  return i > 0 ? normalized.slice(0, i) : '';
}

export const FileTreeItem = memo(function FileTreeItem({ entry, depth = 0, isActive, isDirty, hasOpenTab, isExpanded, isFocused, isBookmarked, onToggleExpand, templateFiles = [], folderTemplates = [], inheritedColor = null, onColorChange, treeSettings }: FileTreeItemProps) {
  const { t } = useTranslation('sidebar');

  const {
    confirmBeforeDelete,
    showFileExtensions,
    showFolderIcons,
    showFileIcons,
    enableFolderColors,
    folderColorSubfolders,
    folderColorFiles,
    folderColorStyle,
    folderColorFileStyle,
    folderColorBold,
    folderColorOpacity,
    folderColorIcon,
    folderColorName,
    folderColorBackground,
    folderColorChevron,
    folderColorFileIcon,
    folderColorFileName,
    folderColorFileBackground,
    enableBookmarks,
    useTrash,
    vaultPath,
  } = treeSettings;

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [folderColor, setFolderColorState] = useState(() =>
    entry.isDir ? getFolderColors()[entry.path] || null : null
  );
  const renameRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const isCommittingRename = useRef(false);

  // Effective color: own color takes priority, then inherited from parent (all gated by feature toggle)
  const effectiveColor = enableFolderColors ? (folderColor || (folderColorSubfolders ? inheritedColor : null)) : null;
  // File inherited color
  const fileColor = enableFolderColors && folderColorFiles ? inheritedColor : null;

  // Resolve style targets from preset or custom toggles
  const color = entry.isDir ? effectiveColor : fileColor;
  const style = entry.isDir ? folderColorStyle : folderColorFileStyle;
  const targets = color ? resolveStyleTargets(style, entry.isDir
    ? { icon: folderColorIcon, name: folderColorName, bg: folderColorBackground, chevron: folderColorChevron }
    : { icon: folderColorFileIcon, name: folderColorFileName, bg: folderColorFileBackground }
  ) : null;

  // Use getState() for action-only refs — these never change, so subscribing wastes re-renders
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
        // Select name without extension for files
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
    const newName = renameValue.trim();
    if (!newName || newName === entry.name) {
      setRenaming(false);
      setRenameError(null);
      return;
    }
    isCommittingRename.current = true;

    const parentDir = getParentDir(entry.path);
    const newPath = parentDir ? `${parentDir}/${newName}` : newName;

    try {
      const wasActive = useEditorStore.getState().activeFilePath === entry.path;
      await renameFile(entry.path, newPath);
      setRenaming(false);
      setRenameError(null);

      // Update any open tabs that reference the old path
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
    } finally {
      isCommittingRename.current = false;
    }
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const performDelete = useCallback(async () => {
    setDeleteConfirmOpen(false);
    // Close all tabs for files being deleted (handles both files and directories)
    const store = useEditorStore.getState();
    const normalizedEntry = entry.path.replace(/\\/g, '/');
    for (let i = store.tabs.length - 1; i >= 0; i--) {
      const tabPath = store.tabs[i].path.replace(/\\/g, '/');
      if (tabPath === normalizedEntry || (entry.isDir && tabPath.startsWith(normalizedEntry + '/'))) {
        store.closeTab(i, true);
      }
    }
    await deleteFile(entry.path);
  }, [entry.path, entry.isDir, deleteFile]);

  const handleDelete = useCallback(() => {
    if (confirmBeforeDelete) {
      setDeleteConfirmOpen(true);
    } else {
      performDelete();
    }
  }, [confirmBeforeDelete, performDelete]);

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [pendingCreateType, setPendingCreateType] = useState<'file' | 'folder'>('file');

  const handleNewFileSubmit = useCallback(async (name: string) => {
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

    // Auto-expand the folder
    if (entry.isDir) {
      onToggleExpand(entry.path, true);
    }
  }, [entry.isDir, entry.path, createFile, openFile, vaultPath, templateFiles]);

  const handleTemplateSelect = useCallback(async (selection: TemplateSelection | null) => {
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
        // No template selected — just create an empty folder
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
  }, [vaultPath, pendingFilePath, pendingCreateType, createFile, createFolder, openFile, t]);

  const handleNewFolderSubmit = useCallback(async (name: string) => {
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
  }, [entry.isDir, entry.path, createFolder, folderTemplates]);

  const handleNewCanvasSubmit = useCallback(async (name: string) => {
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
  }, [entry.isDir, entry.path, createFile, openFile, vaultPath, onToggleExpand]);

  const handleMoveConfirm = useCallback(async (target: string) => {
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
  }, [entry.path, moveFile, openFile, vaultPath]);

  const [dragOver, setDragOver] = useState(false);
  const [colorPicker, setColorPicker] = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [newFileModal, setNewFileModal] = useState(false);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newCanvasModal, setNewCanvasModal] = useState(false);

  const menuItems: MenuItem[] = entry.isDir
    ? [
        { label: t('contextMenu.newFile'), icon: <FilePlus size={12} />, onClick: () => setNewFileModal(true) },
        ...(useSettingsStore.getState().enableCanvas ? [{ label: t('contextMenu.newCanvas'), icon: <LayoutGrid size={12} />, onClick: () => setNewCanvasModal(true) }] : []),
        { label: t('contextMenu.newFolder'), icon: <FolderPlus size={12} />, onClick: () => setNewFolderModal(true) },
        { label: t('contextMenu.rename'), icon: <Pencil size={12} />, onClick: startRename },
        { label: t('contextMenu.moveTo'), icon: <FolderInput size={12} />, onClick: () => setMoveModalOpen(true) },
        ...(enableFolderColors ? [{ label: t('contextMenu.setColor'), icon: <Palette size={12} />, onClick: () => { if (menu) setColorPickerPos({ x: menu.x, y: menu.y }); setColorPicker(true); } }] : []),
        { label: '', icon: undefined, separator: true, onClick: () => {} },
        { label: t('contextMenu.copyPath'), icon: <Copy size={12} />, onClick: () => navigator.clipboard.writeText(entry.path) },
        { label: t('contextMenu.revealInExplorer'), icon: <ExternalLink size={12} />, onClick: () => { if (vaultPath) revealItemInDir(`${vaultPath}/${entry.path}`); } },
        { label: '', icon: undefined, separator: true, onClick: () => {} },
        { label: t('contextMenu.moveToTrash'), icon: <Trash2 size={12} />, danger: true, onClick: handleDelete },
      ]
    : [
        ...(enableBookmarks ? [{
          label: isBookmarked ? t('contextMenu.removeBookmark') : t('contextMenu.bookmark'),
          icon: <Star size={12} fill={isBookmarked ? 'currentColor' : 'none'} />,
          color: isBookmarked ? 'var(--ctp-yellow)' : undefined,
          onClick: () => {
            const settings = useSettingsStore.getState();
            const bookmarks = settings.bookmarkedFiles ?? [];
            if (bookmarks.includes(entry.path)) {
              settings.update({ bookmarkedFiles: bookmarks.filter((p: string) => p !== entry.path) });
            } else {
              settings.update({ bookmarkedFiles: [...bookmarks, entry.path] });
            }
          },
        }] : []),
        { label: t('contextMenu.rename'), icon: <Pencil size={12} />, onClick: startRename },
        { label: t('contextMenu.moveTo'), icon: <FolderInput size={12} />, onClick: () => setMoveModalOpen(true) },
        { label: t('contextMenu.newFileHere'), icon: <FilePlus size={12} />, onClick: () => setNewFileModal(true) },
        ...(useSettingsStore.getState().enableCanvas ? [{ label: t('contextMenu.newCanvasHere'), icon: <LayoutGrid size={12} />, onClick: () => setNewCanvasModal(true) }] : []),
        { label: '', icon: undefined, separator: true, onClick: () => {} },
        { label: t('contextMenu.copyPath'), icon: <Copy size={12} />, onClick: () => navigator.clipboard.writeText(entry.path) },
        { label: t('contextMenu.revealInExplorer'), icon: <ExternalLink size={12} />, onClick: () => { if (vaultPath) revealItemInDir(`${vaultPath}/${entry.path}`); } },
        { label: '', icon: undefined, separator: true, onClick: () => {} },
        { label: t('contextMenu.moveToTrash'), icon: <Trash2 size={12} />, danger: true, onClick: handleDelete },
      ];

  // Append plugin context menu items
  const pluginFileItems = Array.from(usePluginStore.getState().contextMenuItems.values())
    .filter((item) => item.context === 'file')
    .map((item) => ({
      label: item.label,
      onClick: () => item.sandbox.invokeCallback(item.runCallbackId),
    }));
  if (pluginFileItems.length > 0) {
    menuItems.push({ label: '', icon: undefined, separator: true, onClick: () => {} });
    menuItems.push(...pluginFileItems);
  }

  return (
    <div>
      <div
        ref={rowRef}
        role="treeitem"
        aria-selected={isActive}
        aria-expanded={entry.isDir ? isExpanded : undefined}
        className={`flex items-center gap-1.5 py-0.5 ${entry.isDir ? 'cursor-grab' : 'cursor-pointer'} text-sm rounded-sm hover:bg-[var(--ctp-surface0)] transition-colors min-w-0`}
        style={{
          paddingLeft: isActive ? paddingLeft - 2 : targets?.accentBar ? paddingLeft - 1 : paddingLeft,
          backgroundColor: dragOver && entry.isDir ? 'rgba(137, 180, 250, 0.25)' : isActive ? 'var(--ctp-surface0)' : targets?.bg && color ? `color-mix(in srgb, ${color} ${Math.round(folderColorOpacity * 100)}%, transparent)` : undefined,
          color: 'var(--ctp-text)',
          borderLeft: dragOver && entry.isDir ? '2px solid var(--ctp-accent)' : isActive ? '2px solid var(--ctp-accent)' : targets?.accentBar && color ? `3px solid ${color}` : undefined,
          transition: 'background-color 150ms ease, border-left 150ms ease, outline 150ms ease',
          outline: isFocused ? '1px solid var(--ctp-accent)' : '1px solid transparent',
          outlineOffset: '-1px',
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'copyMove';
          e.dataTransfer.setData('text/plain', entry.path);
          e.dataTransfer.setData('cascade/file-path', entry.path);
        }}
        onDragOver={entry.isDir ? (e) => {
          if (!e.dataTransfer.types.includes('text/plain') && !e.dataTransfer.types.includes('cascade/file-path')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDragOver(true);
        } : undefined}
        onDragLeave={entry.isDir ? () => setDragOver(false) : undefined}
        onDrop={entry.isDir ? async (e) => {
          e.preventDefault();
          setDragOver(false);
          const sourcePath = e.dataTransfer.getData('cascade/file-path') || e.dataTransfer.getData('text/plain');
          if (!sourcePath) return;
          // Prevent dropping on self or descendant
          const normalizedSource = sourcePath.replace(/\\/g, '/');
          const normalizedTarget = entry.path.replace(/\\/g, '/');
          if (normalizedTarget === normalizedSource || normalizedTarget.startsWith(normalizedSource + '/')) return;
          const wasActive = useEditorStore.getState().activeFilePath === sourcePath;
          const newPath = await moveFile(sourcePath, entry.path);
          if (newPath && wasActive && vaultPath) {
            const store = useEditorStore.getState();
            const tabIndex = store.tabs.findIndex((tab) => tab.path === sourcePath);
            if (tabIndex !== -1) {
              store.closeTab(tabIndex, true);
            }
            await openFile(vaultPath, newPath);
          }
          // Auto-expand the target folder
          onToggleExpand(entry.path, true);
        } : undefined}
      >
        {entry.isDir ? (
          <>
            <ChevronRight
              size={14}
              className="shrink-0 transition-transform"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', color: targets?.chevron && color ? color : 'var(--ctp-overlay1)' }}
            />
            {showFolderIcons && (isExpanded
              ? <FolderOpen size={14} className="shrink-0" style={{ color: targets?.icon && color ? color : 'var(--ctp-blue)' }} />
              : <Folder size={14} className="shrink-0" style={{ color: targets?.icon && color ? color : 'var(--ctp-blue)' }} />
            )}
          </>
        ) : (
          <>
            <span className="shrink-0" style={{ width: 14 }} />
            {showFileIcons && (
              entry.name.endsWith('.canvas')
                ? <LayoutGrid size={14} className="shrink-0" style={{ color: targets?.icon && color ? color : 'var(--ctp-blue)' }} />
                : <File size={14} className="shrink-0" style={{ color: targets?.icon && color ? color : 'var(--ctp-overlay1)' }} />
            )}
          </>
        )}


        {renaming ? (
          <div className="flex-1 flex flex-col min-w-0">
            <input
              ref={renameRef}
              type="text"
              value={renameValue}
              onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setRenaming(false); setRenameError(null); }
              }}
              onBlur={commitRename}
              className="w-full bg-transparent outline-none text-sm px-1 rounded"
              style={{
                color: 'var(--ctp-text)',
                backgroundColor: 'var(--ctp-surface0)',
                border: `1px solid ${renameError ? 'var(--ctp-red)' : 'var(--ctp-accent)'}`,
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {renameError && (
              <span className="text-xs px-1 truncate" style={{ color: 'var(--ctp-red)' }}>{renameError}</span>
            )}
          </div>
        ) : (
          <>
            {targets?.dot && (
              <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, backgroundColor: color || undefined }} />
            )}
            <span
              className="truncate min-w-0"
              style={{
                color: targets?.name && color ? color : undefined,
                fontWeight: entry.isDir && folderColorBold && effectiveColor ? 600 : undefined,
              }}
            >
              {!entry.isDir && !showFileExtensions
                ? entry.name.replace(/\.[^.]+$/, '')
                : entry.name}
            </span>
            <span className="flex-1" />
            {isDirty ? (
              <span className="shrink-0 mr-2" style={{ color: 'var(--ctp-red)', fontSize: '0.625rem', lineHeight: 1 }}>●</span>
            ) : hasOpenTab && !isActive ? (
              <span className="shrink-0 mr-2 rounded-full" style={{ width: 5, height: 5, backgroundColor: 'var(--ctp-accent)', opacity: 0.7 }} />
            ) : null}
          </>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}

      {moveModalOpen && (
        <MoveFileModal
          open={moveModalOpen}
          fileName={entry.name}
          folders={getFolders()}
          currentDir={getParentDir(entry.path)}
          entryPath={entry.path}
          onClose={() => setMoveModalOpen(false)}
          onMove={handleMoveConfirm}
        />
      )}

      {colorPicker && createPortal(
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => setColorPicker(false)}
        >
          <div
            className="fixed z-[101] p-2 rounded-lg"
            style={{
              left: colorPickerPos.x,
              top: colorPickerPos.y,
              backgroundColor: 'var(--ctp-surface0)',
              border: '1px solid var(--ctp-surface1)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs mb-1.5 px-1" style={{ color: 'var(--ctp-subtext0)' }}>{t('fileTree.folderColor')}</div>
            <div className="grid grid-cols-6 gap-1">
              {FOLDER_PALETTE.map(({ name, cssVar }) => (
                <button
                  key={name}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-125"
                  style={{
                    backgroundColor: cssVar,
                    outline: folderColor === cssVar ? '2px solid var(--ctp-text)' : undefined,
                    outlineOffset: 1,
                  }}
                  title={name}
                  onClick={() => {
                    setFolderColor(entry.path, cssVar);
                    setFolderColorState(cssVar);
                    if (!enableFolderColors) {
                      useSettingsStore.getState().update({ enableFolderColors: true });
                    }
                    setColorPicker(false);
                    setMenu(null);
                    onColorChange?.();
                  }}
                />
              ))}
            </div>
            {folderColor && (
              <button
                className="w-full mt-1.5 text-xs py-1 rounded transition-colors hover:bg-[var(--ctp-surface1)]"
                style={{ color: 'var(--ctp-subtext0)' }}
                onClick={() => {
                  setFolderColor(entry.path, null);
                  setFolderColorState(null);
                  setColorPicker(false);
                  setMenu(null);
                  onColorChange?.();
                }}
              >
                {t('fileTree.resetColor')}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}

      {newFileModal && (
        <InputModal
          open={newFileModal}
          title={t('modals.newFile.title')}
          icon={<FilePlus size={14} />}
          placeholder={t('modals.newFile.placeholder')}
          submitLabel={t('modals.newFile.submitLabel')}
          onClose={() => setNewFileModal(false)}
          onSubmit={handleNewFileSubmit}
          validate={(name) => {
            const fileName = name.endsWith('.md') ? name : `${name}.md`;
            if (entry.children?.some((e) => !e.isDir && e.name.toLowerCase() === fileName.toLowerCase())) {
              return t('modals.newFile.alreadyExists');
            }
            return null;
          }}
        />
      )}

      {newFolderModal && (
        <InputModal
          open={newFolderModal}
          title={t('modals.newFolder.title')}
          icon={<FolderPlus size={14} />}
          placeholder={t('modals.newFolder.placeholder')}
          submitLabel={t('modals.newFolder.submitLabel')}
          onClose={() => setNewFolderModal(false)}
          onSubmit={handleNewFolderSubmit}
          validate={(name) => {
            if (entry.children?.some((e) => e.isDir && e.name.toLowerCase() === name.toLowerCase())) {
              return t('modals.newFolder.alreadyExists');
            }
            return null;
          }}
        />
      )}

      {newCanvasModal && (
        <InputModal
          open={newCanvasModal}
          title={t('modals.newCanvas.title')}
          icon={<LayoutGrid size={14} />}
          placeholder={t('modals.newCanvas.placeholder')}
          submitLabel={t('modals.newCanvas.submitLabel')}
          onClose={() => setNewCanvasModal(false)}
          onSubmit={handleNewCanvasSubmit}
          validate={(name) => {
            const fileName = name.endsWith('.canvas') ? name : `${name}.canvas`;
            if (entry.children?.some((e) => !e.isDir && e.name.toLowerCase() === fileName.toLowerCase())) {
              return t('modals.newCanvas.alreadyExists');
            }
            return null;
          }}
        />
      )}

      {templatePickerOpen && (
        <TemplatePicker
          open={templatePickerOpen}
          templates={pendingCreateType === 'file' ? templateFiles : []}
          folderTemplates={pendingCreateType === 'folder' ? folderTemplates : []}
          onClose={() => { setTemplatePickerOpen(false); setPendingFilePath(null); }}
          onSelect={handleTemplateSelect}
        />
      )}

      {deleteConfirmOpen && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          title={useTrash ? t('modals.delete.titleTrash') : t('modals.delete.titleDelete')}
          message={`${useTrash ? t('modals.delete.messageTrash', { target: entry.isDir ? t('modals.delete.targetFolder') : t('modals.delete.targetFile'), name: entry.name }) : t('modals.delete.messageDelete', { target: entry.isDir ? t('modals.delete.targetFolder') : t('modals.delete.targetFile'), name: entry.name })}`}
          kind="warning"
          confirmLabel={useTrash ? t('modals.delete.confirmTrash') : t('modals.delete.confirmDelete')}
          onConfirm={performDelete}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </div>
  );
});
