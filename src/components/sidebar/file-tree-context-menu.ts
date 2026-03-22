import { createElement } from 'react';
import { FilePlus, FolderPlus, FolderInput, Pencil, Trash2, Palette, Star, Copy, ExternalLink, LayoutGrid } from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type { MenuItem } from './ContextMenu';
import type { FileEntry } from '../../types/index';
import { useSettingsStore } from '../../stores/settings-store';
import { usePluginStore } from '../../stores/plugin-store';

export interface BuildContextMenuItemsArgs {
  entry: FileEntry;
  isBookmarked: boolean;
  enableBookmarks: boolean;
  enableFolderColors: boolean;
  vaultPath: string | null | undefined;
  menu: { x: number; y: number } | null;
  useTrash: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  startRename: () => void;
  handleDelete: () => void;
  setNewFileModal: (v: boolean) => void;
  setNewFolderModal: (v: boolean) => void;
  setNewCanvasModal: (v: boolean) => void;
  setMoveModalOpen: (v: boolean) => void;
  setColorPickerPos: (pos: { x: number; y: number }) => void;
  setColorPicker: (v: boolean) => void;
}

export function buildContextMenuItems(args: BuildContextMenuItemsArgs): MenuItem[] {
  const {
    entry, isBookmarked, enableBookmarks, enableFolderColors, vaultPath, menu,
    t, startRename, handleDelete,
    setNewFileModal, setNewFolderModal, setNewCanvasModal,
    setMoveModalOpen, setColorPickerPos, setColorPicker,
  } = args;

  const enableCanvas = useSettingsStore.getState().enableCanvas;

  const menuItems: MenuItem[] = entry.isDir
    ? [
        { label: t('contextMenu.newFile'), icon: createElement(FilePlus, { size: 12 }), onClick: () => setNewFileModal(true) },
        ...(enableCanvas ? [{ label: t('contextMenu.newCanvas'), icon: createElement(LayoutGrid, { size: 12 }), onClick: () => setNewCanvasModal(true) }] : []),
        { label: t('contextMenu.newFolder'), icon: createElement(FolderPlus, { size: 12 }), onClick: () => setNewFolderModal(true) },
        { label: t('contextMenu.rename'), icon: createElement(Pencil, { size: 12 }), onClick: startRename },
        { label: t('contextMenu.moveTo'), icon: createElement(FolderInput, { size: 12 }), onClick: () => setMoveModalOpen(true) },
        ...(enableFolderColors ? [{
          label: t('contextMenu.setColor'),
          icon: createElement(Palette, { size: 12 }),
          onClick: () => {
            if (menu) setColorPickerPos({ x: menu.x, y: menu.y });
            setColorPicker(true);
          },
        }] : []),
        { label: '', icon: undefined, separator: true, onClick: () => {} },
        { label: t('contextMenu.copyPath'), icon: createElement(Copy, { size: 12 }), onClick: () => navigator.clipboard.writeText(entry.path) },
        { label: t('contextMenu.revealInExplorer'), icon: createElement(ExternalLink, { size: 12 }), onClick: () => { if (vaultPath) revealItemInDir(`${vaultPath}/${entry.path}`); } },
        { label: '', icon: undefined, separator: true, onClick: () => {} },
        { label: t('contextMenu.moveToTrash'), icon: createElement(Trash2, { size: 12 }), danger: true, onClick: handleDelete },
      ]
    : [
        ...(enableBookmarks ? [{
          label: isBookmarked ? t('contextMenu.removeBookmark') : t('contextMenu.bookmark'),
          icon: createElement(Star, { size: 12, fill: isBookmarked ? 'currentColor' : 'none' }),
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
        { label: t('contextMenu.rename'), icon: createElement(Pencil, { size: 12 }), onClick: startRename },
        { label: t('contextMenu.moveTo'), icon: createElement(FolderInput, { size: 12 }), onClick: () => setMoveModalOpen(true) },
        { label: t('contextMenu.newFileHere'), icon: createElement(FilePlus, { size: 12 }), onClick: () => setNewFileModal(true) },
        ...(enableCanvas ? [{ label: t('contextMenu.newCanvasHere'), icon: createElement(LayoutGrid, { size: 12 }), onClick: () => setNewCanvasModal(true) }] : []),
        { label: '', icon: undefined, separator: true, onClick: () => {} },
        { label: t('contextMenu.copyPath'), icon: createElement(Copy, { size: 12 }), onClick: () => navigator.clipboard.writeText(entry.path) },
        { label: t('contextMenu.revealInExplorer'), icon: createElement(ExternalLink, { size: 12 }), onClick: () => { if (vaultPath) revealItemInDir(`${vaultPath}/${entry.path}`); } },
        { label: '', icon: undefined, separator: true, onClick: () => {} },
        { label: t('contextMenu.moveToTrash'), icon: createElement(Trash2, { size: 12 }), danger: true, onClick: handleDelete },
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

  return menuItems;
}
