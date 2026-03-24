import { type RefObject } from 'react';
import { File, Folder, FolderOpen, ChevronRight, LayoutGrid } from 'lucide-react';
import type { FileEntry } from '../../types/index';
import { useEditorStore } from '../../stores/editor-store';
import { useCollabStore } from '../../stores/collab-store';
import { resolveColor, type StyleTargets } from './file-tree-types';

interface FileTreeRowProps {
  entry: FileEntry;
  rowRef: RefObject<HTMLDivElement | null>;
  isActive: boolean;
  isDirty: boolean;
  hasOpenTab: boolean;
  isExpanded: boolean;
  isFocused: boolean;
  dragOver: boolean;
  renaming: boolean;
  renameValue: string;
  renameError: string | null;
  renameRef: RefObject<HTMLInputElement | null>;
  paddingLeft: number;
  color: string | null;
  targets: StyleTargets | null;
  effectiveColor: string | null;
  folderColorOpacity: number;
  folderColorBold: boolean;
  showFolderIcons: boolean;
  showFileIcons: boolean;
  showFileExtensions: boolean;
  vaultPath: string | null | undefined;
  moveFile: (path: string, target: string) => Promise<string | null | undefined>;
  openFile: (vaultPath: string, filePath: string, newTab?: boolean) => Promise<void>;
  onToggleExpand: (path: string, expanded: boolean) => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  setDragOver: (v: boolean) => void;
  setRenameValue: (v: string) => void;
  setRenameError: (v: string | null) => void;
  setRenaming: (v: boolean) => void;
  commitRename: () => void;
}

export function FileTreeRow({
  entry, rowRef, isActive, isDirty, hasOpenTab, isExpanded, isFocused,
  dragOver, renaming, renameValue, renameError, renameRef,
  paddingLeft, color, targets, effectiveColor, folderColorOpacity, folderColorBold,
  showFolderIcons, showFileIcons, showFileExtensions, vaultPath,
  moveFile, openFile, onToggleExpand,
  onClick, onContextMenu, setDragOver, setRenameValue, setRenameError, setRenaming, commitRename,
}: FileTreeRowProps) {
  const resolved = color ? resolveColor(color) : null;
  const collabUsers = useCollabStore((s) => s.users);
  const collabActive = useCollabStore((s) => s.active);
  const fileCollaborators = collabActive
    ? Array.from(collabUsers.values()).filter((u) => u.activeFile === entry.path)
    : [];
  return (
    <div
      ref={rowRef}
      role="treeitem"
      aria-selected={isActive}
      aria-expanded={entry.isDir ? isExpanded : undefined}
      className={`flex items-center gap-1.5 py-0.5 ${entry.isDir ? 'cursor-grab' : 'cursor-pointer'} text-sm rounded-sm hover:bg-[var(--ctp-surface0)] transition-colors min-w-0`}
      style={{
        paddingLeft: isActive ? paddingLeft - 2 : targets?.accentBar ? paddingLeft - 1 : paddingLeft,
        backgroundColor: dragOver && entry.isDir ? 'rgba(137, 180, 250, 0.25)' : isActive ? 'var(--ctp-surface0)' : targets?.bg && resolved ? `color-mix(in srgb, ${resolved} ${Math.round(folderColorOpacity * 100)}%, transparent)` : undefined,
        color: 'var(--ctp-text)',
        borderLeft: dragOver && entry.isDir ? '2px solid var(--ctp-accent)' : isActive ? '2px solid var(--ctp-accent)' : targets?.accentBar && resolved ? `3px solid ${resolved}` : undefined,
        transition: 'background-color 150ms ease, border-left 150ms ease, outline 150ms ease',
        outline: isFocused ? '1px solid var(--ctp-accent)' : '1px solid transparent',
        outlineOffset: '-1px',
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
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
        const normalizedSource = sourcePath.replace(/\\/g, '/');
        const normalizedTarget = entry.path.replace(/\\/g, '/');
        if (normalizedTarget === normalizedSource || normalizedTarget.startsWith(normalizedSource + '/')) return;
        const wasActive = useEditorStore.getState().activeFilePath?.replace(/\\/g, '/') === normalizedSource;
        const newPath = await moveFile(sourcePath, entry.path);
        if (newPath && wasActive && vaultPath) {
          const store = useEditorStore.getState();
          const tabIndex = store.tabs.findIndex((tab) => tab.path === sourcePath);
          if (tabIndex !== -1) store.closeTab(tabIndex, true);
          await openFile(vaultPath, newPath);
        }
        onToggleExpand(entry.path, true);
      } : undefined}
    >
      {entry.isDir ? (
        <>
          <ChevronRight
            size={14}
            className="shrink-0 transition-transform"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', color: targets?.chevron && resolved ? resolved : 'var(--ctp-overlay1)' }}
          />
          {showFolderIcons && (isExpanded
            ? <FolderOpen size={14} className="shrink-0" style={{ color: targets?.icon && resolved ? resolved : 'var(--ctp-blue)' }} />
            : <Folder size={14} className="shrink-0" style={{ color: targets?.icon && resolved ? resolved : 'var(--ctp-blue)' }} />
          )}
        </>
      ) : (
        <>
          <span className="shrink-0" style={{ width: 14 }} />
          {showFileIcons && (
            entry.name.endsWith('.canvas')
              ? <LayoutGrid size={14} className="shrink-0" style={{ color: targets?.icon && resolved ? resolved : 'var(--ctp-blue)' }} />
              : <File size={14} className="shrink-0" style={{ color: targets?.icon && resolved ? resolved : 'var(--ctp-overlay1)' }} />
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
              e.stopPropagation();
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
            <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, backgroundColor: resolved || undefined }} />
          )}
          <span
            className="truncate min-w-0"
            style={{
              color: targets?.name && resolved ? resolved : undefined,
              fontWeight: entry.isDir && folderColorBold && effectiveColor ? 600 : undefined,
            }}
          >
            {!entry.isDir && !showFileExtensions ? entry.name.replace(/\.[^.]+$/, '') : entry.name}
          </span>
          <span className="flex-1" />
          {isDirty ? (
            <span className="shrink-0 mr-2" style={{ color: 'var(--ctp-red)', fontSize: '0.625rem', lineHeight: 1 }}>●</span>
          ) : hasOpenTab && !isActive ? (
            <span className="shrink-0 mr-2 rounded-full" style={{ width: 5, height: 5, backgroundColor: 'var(--ctp-accent)', opacity: 0.7 }} />
          ) : null}
          {fileCollaborators.length > 0 && (
            <span className="flex items-center gap-0.5 shrink-0 mr-1">
              {fileCollaborators.slice(0, 3).map((user, i) => (
                <span
                  key={i}
                  className="rounded-full"
                  style={{ width: 5, height: 5, backgroundColor: user.color }}
                  title={user.name}
                />
              ))}
            </span>
          )}
        </>
      )}
    </div>
  );
}
