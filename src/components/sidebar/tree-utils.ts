import type { FileEntry } from '../../types/index';
import type { FileSortOrder } from '../../stores/settings-store';
import { getFolderColors } from './file-tree-types';

const EXPANDED_STORAGE_KEY = 'cascade-expanded-paths';

export function loadExpandedPaths(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore parse errors */ }
  return new Set();
}

export function saveExpandedPaths(paths: Set<string>) {
  localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...paths]));
}

export const getFolderColorsMap = getFolderColors;

export interface FlatFileEntry {
  entry: FileEntry;
  depth: number;
  inheritedColor: string | null;
  ownColor: string | null;
}

/** Flatten visible tree entries with depth and inherited color for virtualized rendering. */
export function flattenVisibleEntries(
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
    const directColor = entry.isDir ? (folderColors[entry.path] || null) : null;
    result.push({ entry, depth, inheritedColor, ownColor: directColor });
    if (entry.isDir && entry.children) {
      if (forceExpand || expandedPaths.has(entry.path)) {
        const effectiveColor = enableFolderColors
          ? (directColor || (folderColorSubfolders ? inheritedColor : null))
          : null;
        flattenVisibleEntries(
          entry.children, forceExpand, expandedPaths,
          folderColors, enableFolderColors, folderColorSubfolders,
          depth + 1, effectiveColor, result,
        );
      }
    }
  }
  return result;
}

export function collectFolderPaths(entries: FileEntry[]): string[] {
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.isDir) {
      paths.push(entry.path);
      if (entry.children) paths.push(...collectFolderPaths(entry.children));
    }
  }
  return paths;
}

export function sortTree(entries: FileEntry[], order: FileSortOrder): FileEntry[] {
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
export function filterTree(entries: FileEntry[], query: string): FileEntry[] {
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
