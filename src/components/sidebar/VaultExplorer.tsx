import { useEffect, useRef, useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, FolderPlus, FilePlus, Search, X, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useVaultStore } from '../../stores/vault-store';
import { SkeletonLine } from '../Skeleton';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore, type FileSortOrder } from '../../stores/settings-store';
import { VaultPicker } from './VaultPicker';
import { FileTreeItem, type TreeSettings } from './FileTreeItem';
import { InputModal } from './InputModal';
import { TemplatePicker, type TemplateSelection } from './TemplatePicker';
import { readFile, writeFile, copyTemplateFolder } from '../../lib/tauri-commands';
import { applyTemplateVariables } from '../../lib/template-utils';
import { useToastStore } from '../../stores/toast-store';
import type { FileEntry } from '../../types/index';

const EXPANDED_STORAGE_KEY = 'cascade-expanded-paths';
const FOLDER_COLOR_KEY = 'cascade-folder-colors';

function loadExpandedPaths(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore parse errors */ }
  return new Set();
}

function saveExpandedPaths(paths: Set<string>) {
  localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...paths]));
}

function getFolderColorsMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FOLDER_COLOR_KEY) || '{}');
  } catch { return {}; }
}

export interface FlatFileEntry {
  entry: FileEntry;
  depth: number;
  inheritedColor: string | null;
}

/** Flatten visible tree entries with depth and inherited color for virtualized rendering. */
function flattenVisibleEntries(
  entries: FileEntry[],
  forceExpand: boolean,
  expandedPaths: Set<string>,
  folderColors: Record<string, string>,
  enableFolderColors: boolean,
  folderColorSubfolders: boolean,
  depth: number = 0,
  inheritedColor: string | null = null,
  result: FlatFileEntry[] = [],
): FlatFileEntry[] {
  for (const entry of entries) {
    result.push({ entry, depth, inheritedColor });
    if (entry.isDir && entry.children) {
      if (forceExpand || expandedPaths.has(entry.path)) {
        const ownColor = enableFolderColors
          ? (folderColors[entry.path] || (folderColorSubfolders ? inheritedColor : null))
          : null;
        flattenVisibleEntries(
          entry.children, forceExpand, expandedPaths,
          folderColors, enableFolderColors, folderColorSubfolders,
          depth + 1, ownColor, result,
        );
      }
    }
  }
  return result;
}

function collectFolderPaths(entries: FileEntry[]): string[] {
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.isDir) {
      paths.push(entry.path);
      if (entry.children) paths.push(...collectFolderPaths(entry.children));
    }
  }
  return paths;
}

function sortTree(entries: FileEntry[], order: FileSortOrder): FileEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Folders always come first
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    switch (order) {
      case 'name-desc':
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      case 'modified-newest':
        return (b.modified ?? 0) - (a.modified ?? 0);
      case 'modified-oldest':
        return (a.modified ?? 0) - (b.modified ?? 0);
      case 'name-asc':
      default:
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }
  });
  return sorted.map((e) =>
    e.isDir && e.children ? { ...e, children: sortTree(e.children, order) } : e,
  );
}

/** Returns a filtered tree keeping only entries whose name (or descendants) match the query. */
function filterTree(entries: FileEntry[], query: string): FileEntry[] {
  const q = query.toLowerCase();
  const result: FileEntry[] = [];
  for (const entry of entries) {
    if (entry.isDir && entry.children) {
      const filtered = filterTree(entry.children, query);
      if (filtered.length > 0) {
        result.push({ ...entry, children: filtered });
      }
    } else if (entry.name.toLowerCase().includes(q)) {
      result.push(entry);
    }
  }
  return result;
}

const SKELETON_WIDTHS = ['60%', '75%', '45%', '80%', '55%', '70%', '50%', '65%', '72%', '48%'];

export function VaultExplorer() {
  const { t } = useTranslation('sidebar');

  const fileTree = useVaultStore((s) => s.fileTree);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const isLoading = useVaultStore((s) => s.isLoading);
  const createFile = useVaultStore((s) => s.createFile);
  const createFolder = useVaultStore((s) => s.createFolder);
  const openFile = useEditorStore((s) => s.openFile);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const dirtyPaths = useEditorStore((s) => s.dirtyPaths);
  const openTabPaths = useEditorStore(useShallow((s) => new Set(s.tabs.map((t) => t.path))));
  const {
    fileSortOrder,
    templatesFolder,
    enableTemplates,
    enableFolderColors,
    folderColorSubfolders,
    confirmBeforeDelete,
    showFileExtensions,
    showFolderIcons,
    showFileIcons,
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
    bookmarkedFiles,
  } = useSettingsStore(useShallow((s) => ({
    fileSortOrder: s.fileSortOrder,
    templatesFolder: s.templatesFolder,
    enableTemplates: s.enableTemplates,
    enableFolderColors: s.enableFolderColors,
    folderColorSubfolders: s.folderColorSubfolders,
    confirmBeforeDelete: s.confirmBeforeDelete,
    showFileExtensions: s.showFileExtensions,
    showFolderIcons: s.showFolderIcons,
    showFileIcons: s.showFileIcons,
    folderColorFiles: s.folderColorFiles,
    folderColorStyle: s.folderColorStyle,
    folderColorFileStyle: s.folderColorFileStyle,
    folderColorBold: s.folderColorBold,
    folderColorOpacity: s.folderColorOpacity,
    folderColorIcon: s.folderColorIcon,
    folderColorName: s.folderColorName,
    folderColorBackground: s.folderColorBackground,
    folderColorChevron: s.folderColorChevron,
    folderColorFileIcon: s.folderColorFileIcon,
    folderColorFileName: s.folderColorFileName,
    folderColorFileBackground: s.folderColorFileBackground,
    enableBookmarks: s.enableBookmarks,
    useTrash: s.useTrash,
    bookmarkedFiles: s.bookmarkedFiles,
  })));

  const treeSettings = useMemo<TreeSettings>(() => ({
    confirmBeforeDelete, showFileExtensions, showFolderIcons, showFileIcons,
    enableFolderColors, folderColorSubfolders, folderColorFiles,
    folderColorStyle, folderColorFileStyle, folderColorBold, folderColorOpacity,
    folderColorIcon, folderColorName, folderColorBackground, folderColorChevron,
    folderColorFileIcon, folderColorFileName, folderColorFileBackground,
    enableBookmarks, useTrash, vaultPath,
  }), [
    confirmBeforeDelete, showFileExtensions, showFolderIcons, showFileIcons,
    enableFolderColors, folderColorSubfolders, folderColorFiles,
    folderColorStyle, folderColorFileStyle, folderColorBold, folderColorOpacity,
    folderColorIcon, folderColorName, folderColorBackground, folderColorChevron,
    folderColorFileIcon, folderColorFileName, folderColorFileBackground,
    enableBookmarks, useTrash, vaultPath,
  ]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [newFileModal, setNewFileModal] = useState(false);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [pendingCreateType, setPendingCreateType] = useState<'file' | 'folder'>('file');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(loadExpandedPaths);
  const [colorVersion, setColorVersion] = useState(0);
  const [folderColorsMap, setFolderColorsMap] = useState<Record<string, string>>(getFolderColorsMap);

  useEffect(() => {
    setFolderColorsMap(getFolderColorsMap());
  }, [colorVersion]);
  const updateExpanded = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setExpandedPaths((prev) => {
      const next = updater(prev);
      saveExpandedPaths(next);
      return next;
    });
  }, []);

  const bookmarkSet = useMemo(() => new Set(bookmarkedFiles), [bookmarkedFiles]);

  const [revealPath, setRevealPath] = useState<string | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const prevActiveFilePathRef = useRef<string | null>(null);

  // Auto-reveal active file in tree when activeFilePath changes
  useEffect(() => {
    if (!activeFilePath) return;
    if (activeFilePath === prevActiveFilePathRef.current) return;
    prevActiveFilePathRef.current = activeFilePath;

    const normalized = activeFilePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const ancestors: string[] = [];
    for (let i = 1; i < parts.length - 1; i++) {
      ancestors.push(parts.slice(0, i + 1).join('/'));
    }
    updateExpanded((prev) => {
      if (ancestors.every((a) => prev.has(a))) return prev;
      const next = new Set(prev);
      for (const a of ancestors) next.add(a);
      return next;
    });

    setRevealPath(normalized);
  }, [activeFilePath]);

  // Re-render tree when breadcrumb reveals a folder
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        const normalized = (detail.path as string).replace(/\\/g, '/');
        const parts = normalized.split('/');
        updateExpanded((prev) => {
          const next = new Set(prev);
          for (let i = 0; i < parts.length; i++) {
            next.add(parts.slice(0, i + 1).join('/'));
          }
          return next;
        });
        setRevealPath(normalized);
      }
    };
    window.addEventListener('cascade:reveal-in-tree', handler);
    return () => window.removeEventListener('cascade:reveal-in-tree', handler);
  }, []);

  const handleToggleExpand = useCallback((path: string, expanded: boolean) => {
    updateExpanded((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(path);
      else next.delete(path);
      return next;
    });
  }, [updateExpanded]);

  const handleExpandAll = useCallback(() => {
    const allPaths = collectFolderPaths(fileTree);
    const next = new Set(allPaths);
    setExpandedPaths(next);
    saveExpandedPaths(next);
  }, [fileTree]);

  const handleCollapseAll = useCallback(() => {
    const next = new Set<string>();
    setExpandedPaths(next);
    saveExpandedPaths(next);
  }, []);

  const handleColorChange = useCallback(() => {
    setColorVersion((v) => v + 1);
  }, []);

  const sortedTree = useMemo(
    () => sortTree(fileTree, fileSortOrder),
    [fileTree, fileSortOrder],
  );

  const filteredTree = useMemo(
    () => (deferredSearch ? filterTree(sortedTree, deferredSearch) : sortedTree),
    [sortedTree, deferredSearch],
  );

  const forceExpand = !!deferredSearch;

  /** Flat list of all visible entries for virtualized rendering. */
  const flatEntries = useMemo(() => {
    return flattenVisibleEntries(
      filteredTree, forceExpand, expandedPaths,
      folderColorsMap, enableFolderColors, folderColorSubfolders,
    );
  }, [filteredTree, forceExpand, expandedPaths, enableFolderColors, folderColorSubfolders, folderColorsMap]);

  const pathToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < flatEntries.length; i++) {
      map.set(flatEntries[i].entry.path, i);
    }
    return map;
  }, [flatEntries]);

  // Scroll to revealed item and flash-highlight via DOM (avoids re-rendering all FileTreeItems)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRevealElRef = useRef<Element | null>(null);
  useEffect(() => {
    if (!revealPath || !treeRef.current) return;
    // Always clean up previous highlight immediately
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (prevRevealElRef.current) {
      prevRevealElRef.current.classList.remove('tree-item-revealed');
      prevRevealElRef.current = null;
    }
    const el = treeRef.current.querySelector(`[data-path="${CSS.escape(revealPath)}"]`);
    if (el) {
      el.classList.add('tree-item-revealed');
      el.scrollIntoView({ block: 'nearest' });
      prevRevealElRef.current = el;
      revealTimerRef.current = setTimeout(() => {
        el.classList.remove('tree-item-revealed');
        prevRevealElRef.current = null;
        revealTimerRef.current = null;
        setRevealPath(null);
      }, 1500);
    }
  }, [revealPath, flatEntries]);

  // Scroll to focused item
  useEffect(() => {
    if (!focusedPath || !treeRef.current) return;
    const el = treeRef.current.querySelector(`[data-path="${CSS.escape(focusedPath)}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedPath]);

  /** All .md files and folder templates inside the templates folder */
  const { templateFiles, folderTemplates } = useMemo(() => {
    const folder = templatesFolder.trim().replace(/\\/g, '/').replace(/\/$/, '');
    if (!folder) return { templateFiles: [] as FileEntry[], folderTemplates: [] as FileEntry[] };
    const files: FileEntry[] = [];
    const folders: FileEntry[] = [];
    const walk = (entries: FileEntry[]) => {
      for (const entry of entries) {
        if (entry.isDir) {
          const entryPath = entry.path.replace(/\\/g, '/');
          if (entryPath === folder) {
            // Inside the templates root — collect direct children
            if (entry.children) {
              for (const child of entry.children) {
                if (child.isDir) {
                  // Direct child folder = folder template
                  folders.push(child);
                } else if (child.name.toLowerCase().endsWith('.md')) {
                  // Direct child .md = file template
                  files.push(child);
                }
              }
            }
          } else if (entry.children) {
            walk(entry.children);
          }
        }
      }
    };
    walk(fileTree);
    return { templateFiles: files, folderTemplates: folders };
  }, [fileTree, templatesFolder]);

  const handleNewFile = useCallback(async (name: string) => {
    if (!vaultPath) return;
    setNewFileModal(false);
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    if (enableTemplates && templateFiles.length > 0) {
      setPendingFileName(fileName);
      setPendingCreateType('file');
      setTemplatePickerOpen(true);
    } else {
      try {
        await createFile(fileName);
        await openFile(vaultPath, fileName);
      } catch (e) {
        useToastStore.getState().addToast(`Failed to create "${fileName}": ${e instanceof Error ? e.message : e}`, 'error');
      }
    }
  }, [vaultPath, createFile, openFile, templateFiles, enableTemplates]);

  const handleTemplateSelect = useCallback(async (selection: TemplateSelection | null) => {
    setTemplatePickerOpen(false);
    if (!vaultPath || !pendingFileName) return;
    const fileName = pendingFileName;
    const createType = pendingCreateType;
    setPendingFileName(null);

    // Folder creation flow
    if (createType === 'folder') {
      if (selection?.type === 'folder') {
        try {
          const createdFiles = await copyTemplateFolder(vaultPath, selection.path, fileName);
          let clipboard = '';
          try { clipboard = await navigator.clipboard.readText(); } catch { /* clipboard unavailable */ }
          for (const filePath of createdFiles) {
            if (filePath.toLowerCase().endsWith('.md')) {
              try {
                const raw = await readFile(vaultPath, filePath);
                const { text } = await applyTemplateVariables(raw, filePath, clipboard);
                await writeFile(vaultPath, filePath, text);
              } catch { /* skip files that fail substitution */ }
            }
          }
          const firstMd = createdFiles.find(f => f.toLowerCase().endsWith('.md'));
          if (firstMd) {
            await openFile(vaultPath, firstMd);
          }
        } catch {
          useToastStore.getState().addToast(t('toast.failedFolderTemplate'), 'error');
          await createFolder(fileName);
        }
      } else {
        // No template selected — just create an empty folder
        await createFolder(fileName);
      }
      return;
    }

    // File creation flow
    if (selection?.type === 'file') {
      try {
        const raw = await readFile(vaultPath, selection.path);
        let clipboard = '';
        try { clipboard = await navigator.clipboard.readText(); } catch { /* clipboard unavailable */ }
        const { text } = await applyTemplateVariables(raw, fileName, clipboard);
        await createFile(fileName);
        await writeFile(vaultPath, fileName, text);
      } catch {
        useToastStore.getState().addToast(t('toast.failedTemplate'), 'error');
        await createFile(fileName);
      }
      await openFile(vaultPath, fileName);
    } else {
      await createFile(fileName);
      await openFile(vaultPath, fileName);
    }
  }, [vaultPath, pendingFileName, pendingCreateType, createFile, createFolder, openFile, t]);

  const handleNewFolder = useCallback(async (name: string) => {
    if (!vaultPath) return;
    setNewFolderModal(false);
    if (enableTemplates && folderTemplates.length > 0) {
      setPendingFileName(name);
      setPendingCreateType('folder');
      setTemplatePickerOpen(true);
    } else {
      try {
        await createFolder(name);
      } catch (e) {
        useToastStore.getState().addToast(`Failed to create folder "${name}": ${e instanceof Error ? e.message : e}`, 'error');
      }
    }
  }, [vaultPath, createFolder, folderTemplates, enableTemplates]);

  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (flatEntries.length === 0) return;

    const currentIdx = focusedPath ? (pathToIndex.get(focusedPath) ?? -1) : -1;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = Math.min(currentIdx + 1, flatEntries.length - 1);
        setFocusedPath(flatEntries[next].entry.path);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = currentIdx <= 0 ? 0 : currentIdx - 1;
        setFocusedPath(flatEntries[prev].entry.path);
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (currentIdx < 0) break;
        const entry = flatEntries[currentIdx].entry;
        if (entry.isDir) {
          updateExpanded((p) => new Set([...p, entry.path]));
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (currentIdx < 0) break;
        const entry = flatEntries[currentIdx].entry;
        if (entry.isDir) {
          updateExpanded((p) => { const n = new Set(p); n.delete(entry.path); return n; });
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (currentIdx < 0) break;
        const entry = flatEntries[currentIdx].entry;
        if (entry.isDir) {
          updateExpanded((p) => {
            const n = new Set(p);
            if (n.has(entry.path)) n.delete(entry.path);
            else n.add(entry.path);
            return n;
          });
        } else if (vaultPath) {
          openFile(vaultPath, entry.path);
        }
        break;
      }
      case ' ': {
        e.preventDefault();
        if (currentIdx < 0) break;
        const entry = flatEntries[currentIdx].entry;
        if (entry.isDir) {
          updateExpanded((p) => {
            const n = new Set(p);
            if (n.has(entry.path)) n.delete(entry.path);
            else n.add(entry.path);
            return n;
          });
        }
        break;
      }
    }
  }, [flatEntries, focusedPath, vaultPath, openFile, updateExpanded, pathToIndex]);

  return (
    <div className="flex flex-col h-full">
      <VaultPicker />

      {vaultPath && (
        <>
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--ctp-overlay1)' }}>
              {t('panels.files')}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleExpandAll}
                className="p-1 rounded hover:bg-[var(--ctp-surface0)] transition-colors"
                style={{ color: 'var(--ctp-overlay1)' }}
                title={t('tooltips.expandAll')}
              >
                <ChevronsUpDown size={14} />
              </button>
              <button
                onClick={handleCollapseAll}
                className="p-1 rounded hover:bg-[var(--ctp-surface0)] transition-colors"
                style={{ color: 'var(--ctp-overlay1)' }}
                title={t('tooltips.collapseAll')}
              >
                <ChevronsDownUp size={14} />
              </button>
              <button
                onClick={() => setNewFolderModal(true)}
                className="p-1 rounded hover:bg-[var(--ctp-surface0)] transition-colors"
                style={{ color: 'var(--ctp-overlay1)' }}
                title={t('tooltips.newFolder')}
              >
                <FolderPlus size={14} />
              </button>
              <button
                onClick={() => setNewFileModal(true)}
                className="p-1 rounded hover:bg-[var(--ctp-surface0)] transition-colors"
                style={{ color: 'var(--ctp-overlay1)' }}
                title={t('tooltips.newFile')}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="px-2 pb-1">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: 'var(--ctp-surface0)',
                color: 'var(--ctp-text)',
              }}
            >
              <Search size={12} style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('filters.searchFiles')}
                className="flex-1 bg-transparent outline-none placeholder:text-[var(--ctp-overlay0)]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="rounded p-0.5 hover:bg-[var(--ctp-surface1)] transition-colors"
                  style={{ color: 'var(--ctp-overlay1)', flexShrink: 0 }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <div
        ref={treeRef}
        className="flex-1 overflow-y-auto py-1"
        style={{ overscrollBehavior: 'contain' }}
        role="tree"
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2 px-3 py-2">
            {SKELETON_WIDTHS.map((width, i) => (
              <SkeletonLine key={i} width={width} height="14px" />
            ))}
          </div>
        ) : flatEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
            <FolderPlus size={32} strokeWidth={1} style={{ color: 'var(--ctp-overlay0)' }} />
            <p className="text-xs text-center" style={{ color: 'var(--ctp-overlay0)' }}>
              {t('emptyStates.vaultEmpty')}
            </p>
            <p className="text-[10px] text-center" style={{ color: 'var(--ctp-surface2)' }}>
              {t('emptyStates.vaultEmptyHint')}
            </p>
          </div>
        ) : (
          <div>
            {flatEntries.map((flat) => {
              const itemPath = flat.entry.path;
              return (
                <div key={itemPath} data-path={itemPath}>
                  <FileTreeItem
                    entry={flat.entry}
                    depth={flat.depth}
                    isExpanded={forceExpand || expandedPaths.has(itemPath)}
                    isActive={!flat.entry.isDir && activeFilePath === itemPath}
                    isDirty={!flat.entry.isDir && dirtyPaths.has(itemPath)}
                    hasOpenTab={!flat.entry.isDir && openTabPaths.has(itemPath)}
                    isFocused={focusedPath === itemPath}
                    isBookmarked={enableBookmarks && bookmarkSet.has(itemPath)}
                    onToggleExpand={handleToggleExpand}
                    templateFiles={templateFiles}
                    folderTemplates={folderTemplates}
                    inheritedColor={flat.inheritedColor}
                    onColorChange={handleColorChange}
                    treeSettings={treeSettings}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <InputModal
        open={newFileModal}
        title={t('modals.newFile.title')}
        icon={<FilePlus size={14} />}
        placeholder={t('modals.newFile.placeholder')}
        submitLabel={t('modals.newFile.submitLabel')}
        onClose={() => setNewFileModal(false)}
        onSubmit={handleNewFile}
        validate={(name) => {
          const fileName = name.endsWith('.md') ? name : `${name}.md`;
          if (fileTree.some((e) => !e.isDir && e.name.toLowerCase() === fileName.toLowerCase())) {
            return t('modals.newFile.alreadyExists');
          }
          return null;
        }}
      />

      <InputModal
        open={newFolderModal}
        title={t('modals.newFolder.title')}
        icon={<FolderPlus size={14} />}
        placeholder={t('modals.newFolder.placeholder')}
        submitLabel={t('modals.newFolder.submitLabel')}
        onClose={() => setNewFolderModal(false)}
        onSubmit={handleNewFolder}
        validate={(name) => {
          if (fileTree.some((e) => e.isDir && e.name.toLowerCase() === name.toLowerCase())) {
            return t('modals.newFolder.alreadyExists');
          }
          return null;
        }}
      />

      <TemplatePicker
        open={templatePickerOpen}
        templates={pendingCreateType === 'file' ? templateFiles : []}
        folderTemplates={pendingCreateType === 'folder' ? folderTemplates : []}
        onClose={() => { setTemplatePickerOpen(false); setPendingFileName(null); }}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}
