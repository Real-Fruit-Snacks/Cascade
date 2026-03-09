import { create } from 'zustand';
import type { FileEntry } from '../types/index';
import * as cmd from '../lib/tauri-commands';
import { getAllFilePaths } from '../lib/wiki-link-resolver';
import { extractTags } from '../lib/tag-utils';
import { useSettingsStore } from './settings-store';
import { useToastStore } from './toast-store';

const WIKI_LINK_RE = /\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g;

/** Extract all wiki-link targets from text (lowercase, without .md extension). */
function extractLinks(text: string): string[] {
  const links = new Set<string>();
  WIKI_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKI_LINK_RE.exec(text)) !== null) {
    links.add(match[1].toLowerCase().replace(/\.md$/, ''));
  }
  return [...links];
}

export interface BacklinkEntry {
  filePath: string;
  /** Lines in the source file that contain the link */
  contextLines: string[];
}

interface VaultState {
  vaultPath: string | null;
  fileTree: FileEntry[];
  flatFiles: string[];
  /** Map of tag -> set of file paths that contain it */
  tagIndex: Map<string, Set<string>>;
  /** Map of target (lowercase, no .md) -> set of file paths that link to it */
  backlinkIndex: Map<string, Set<string>>;
  /** Reverse map: file path -> set of tags it contains (for O(1) old-tag lookup) */
  fileToTags: Map<string, Set<string>>;
  /** Reverse map: file path -> set of link targets it contains (for O(1) old-link lookup) */
  fileToLinks: Map<string, Set<string>>;
  isLoading: boolean;
  isIndexing: boolean;
  error: string | null;
  recentVaults: string[];
}

interface VaultActions {
  openVault: (path: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  buildTagIndex: () => Promise<void>;
  updateFileTags: (filePath: string, content: string) => void;
  updateFileLinks: (filePath: string, content: string) => void;
  renameTag: (oldTag: string, newTag: string) => Promise<number>;
  createFile: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  moveFile: (srcPath: string, destDir: string) => Promise<string | null>;
  getFolders: () => string[];
  closeVault: () => void;
}

let buildTagSeq = 0;

const RECENT_VAULTS_KEY = 'cascade-recent-vaults';
function loadRecentVaults(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_VAULTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Validate: must be an array of non-empty strings (no injection via tampered localStorage)
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0 && !v.includes('\0'));
  } catch { /* ignore */ }
  return [];
}

export const useVaultStore = create<VaultState & VaultActions>((set, get) => ({
  vaultPath: null,
  fileTree: [],
  flatFiles: [],
  tagIndex: new Map(),
  backlinkIndex: new Map(),
  fileToTags: new Map(),
  fileToLinks: new Map(),
  isLoading: false,
  isIndexing: false,
  error: null,
  recentVaults: loadRecentVaults(),

  openVault: async (path: string) => {
    set({
      isLoading: true,
      error: null,
      tagIndex: new Map(),
      backlinkIndex: new Map(),
      fileToTags: new Map(),
      fileToLinks: new Map(),
    });
    try {
      // Parallelize the two independent startup IPC calls
      const [tree] = await Promise.all([
        cmd.openVault(path),
        useSettingsStore.getState().loadFromVault(path),
      ]);
      // Load per-vault recent files so the welcome screen shows the right list
      const { useEditorStore } = await import('./editor-store');
      useEditorStore.getState().loadRecentFiles(path);
      set((s) => ({
        vaultPath: path,
        fileTree: tree,
        flatFiles: getAllFilePaths(tree),
        isLoading: false,
        recentVaults: (() => {
          const updated = [path, ...s.recentVaults.filter((v) => v !== path)].slice(0, 10);
          localStorage.setItem(RECENT_VAULTS_KEY, JSON.stringify(updated));
          return updated;
        })(),
      }));
      // Defer buildTagIndex and plugin discovery to after first render
      const idleCb = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (fn: () => void) => setTimeout(fn, 0);
      idleCb(async () => {
        await get().buildTagIndex();
        const { usePluginStore } = await import('./plugin-store');
        if (useSettingsStore.getState().pluginsEnabled) {
          usePluginStore.getState().discoverPlugins(path);
        }
      });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  closeVault: () => {
    import('./plugin-store').then(({ usePluginStore }) => {
      usePluginStore.getState().unloadAll();
    });
    set({
      vaultPath: null,
      fileTree: [],
      flatFiles: [],
      tagIndex: new Map(),
      backlinkIndex: new Map(),
      fileToTags: new Map(),
      fileToLinks: new Map(),
      isLoading: false,
      isIndexing: false,
      error: null,
    });
  },

  refreshTree: async () => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    try {
      const tree = await cmd.listFiles(vaultPath);
      set({ fileTree: tree, flatFiles: getAllFilePaths(tree) });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  buildTagIndex: async () => {
    const seq = ++buildTagSeq;
    const { vaultPath } = get();
    if (!vaultPath) return;
    set({ isIndexing: true });

    try {
      const index = await cmd.buildIndex(vaultPath);
      if (seq !== buildTagSeq) return;

      // Convert Record<string, string[]> to Map<string, Set<string>>
      const tagIdx = new Map<string, Set<string>>();
      const fileToTagsNew = new Map<string, Set<string>>();
      for (const [tag, files] of Object.entries(index.tagIndex)) {
        tagIdx.set(tag, new Set(files));
        for (const f of files) {
          let s = fileToTagsNew.get(f);
          if (!s) { s = new Set(); fileToTagsNew.set(f, s); }
          s.add(tag);
        }
      }
      const linkIdx = new Map<string, Set<string>>();
      const fileToLinksNew = new Map<string, Set<string>>();
      for (const [target, files] of Object.entries(index.backlinkIndex)) {
        linkIdx.set(target, new Set(files));
        for (const f of files) {
          let s = fileToLinksNew.get(f);
          if (!s) { s = new Set(); fileToLinksNew.set(f, s); }
          s.add(target);
        }
      }

      set({ tagIndex: tagIdx, backlinkIndex: linkIdx, fileToTags: fileToTagsNew, fileToLinks: fileToLinksNew, isIndexing: false });
    } catch {
      if (seq === buildTagSeq) set({ isIndexing: false });
    }
  },

  updateFileTags: (filePath: string, content: string) => {
    const { tagIndex, fileToTags } = get();
    const fileTags = extractTags(content);

    // O(1) lookup via reverse map instead of O(N) scan
    const oldTags = fileToTags.get(filePath) ?? new Set<string>();

    // If nothing changed, skip the update entirely
    const newTags = new Set(fileTags);
    if (oldTags.size === newTags.size && [...oldTags].every((t) => newTags.has(t))) return;

    // Only clone affected entries, share references to unchanged ones
    const newIndex = new Map(tagIndex);
    for (const tag of oldTags) {
      if (!newTags.has(tag)) {
        const files = newIndex.get(tag)!;
        if (files.size === 1) {
          newIndex.delete(tag);
        } else {
          const copy = new Set(files);
          copy.delete(filePath);
          newIndex.set(tag, copy);
        }
      }
    }
    for (const tag of newTags) {
      if (!oldTags.has(tag)) {
        const existing = newIndex.get(tag);
        const copy = existing ? new Set(existing) : new Set<string>();
        copy.add(filePath);
        newIndex.set(tag, copy);
      }
    }

    // Update reverse map
    const newFileToTags = new Map(fileToTags);
    if (newTags.size === 0) {
      newFileToTags.delete(filePath);
    } else {
      newFileToTags.set(filePath, newTags);
    }

    set({ tagIndex: newIndex, fileToTags: newFileToTags });
  },

  updateFileLinks: (filePath: string, content: string) => {
    const { backlinkIndex, fileToLinks } = get();
    const fileLinks = extractLinks(content);

    // O(1) lookup via reverse map instead of O(N) scan
    const oldTargets = fileToLinks.get(filePath) ?? new Set<string>();

    // If nothing changed, skip the update entirely
    const newTargets = new Set(fileLinks);
    if (oldTargets.size === newTargets.size && [...oldTargets].every((t) => newTargets.has(t))) return;

    // Only clone affected entries, share references to unchanged ones
    const newIndex = new Map(backlinkIndex);
    for (const target of oldTargets) {
      if (!newTargets.has(target)) {
        const files = newIndex.get(target)!;
        if (files.size === 1) {
          newIndex.delete(target);
        } else {
          const copy = new Set(files);
          copy.delete(filePath);
          newIndex.set(target, copy);
        }
      }
    }
    for (const target of newTargets) {
      if (!oldTargets.has(target)) {
        const existing = newIndex.get(target);
        const copy = existing ? new Set(existing) : new Set<string>();
        copy.add(filePath);
        newIndex.set(target, copy);
      }
    }

    // Update reverse map
    const newFileToLinks = new Map(fileToLinks);
    if (newTargets.size === 0) {
      newFileToLinks.delete(filePath);
    } else {
      newFileToLinks.set(filePath, newTargets);
    }

    set({ backlinkIndex: newIndex, fileToLinks: newFileToLinks });
  },

  renameTag: async (oldTag: string, newTag: string) => {
    const { vaultPath, tagIndex } = get();
    if (!vaultPath) return 0;
    const files = tagIndex.get(oldTag);
    if (!files || files.size === 0) return 0;

    // Build a regex that matches inline #oldTag with word boundary (case-insensitive)
    const escaped = oldTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inlineRe = new RegExp(`((?:^|(?<=\\s))#)${escaped}(?=[\\s,.;:!?)\\]}]|$)`, 'gi');

    // Build a regex for YAML frontmatter list items (e.g. "  - oldTag" or in inline arrays)
    const fmItemRe = new RegExp(`^(\\s*-\\s+)${escaped}\\s*$`, 'gim');
    const fmInlineRe = new RegExp(`(?<=[[,]\\s*)${escaped}(?=\\s*[,\\]])`, 'gi');

    let count = 0;
    for (const filePath of files) {
      try {
        const text = await cmd.readFile(vaultPath, filePath);
        let replaced = text;

        // Replace in YAML frontmatter
        const fmMatch = replaced.match(/^(---\r?\n)([\s\S]*?\r?\n)(---)/);
        if (fmMatch) {
          let fm = fmMatch[2];
          fm = fm.replace(fmItemRe, `$1${newTag}`);
          fm = fm.replace(fmInlineRe, newTag);
          replaced = fmMatch[1] + fm + fmMatch[3] + replaced.slice(fmMatch[0].length);
        }

        // Replace inline #tags in body
        replaced = replaced.replace(inlineRe, `$1${newTag}`);

        if (replaced !== text) {
          await cmd.writeFile(vaultPath, filePath, replaced);
          count++;
        }
      } catch {
        // Skip files that can't be read/written
      }
    }

    // Rebuild the tag index to reflect changes
    await get().buildTagIndex();
    return count;
  },

  createFile: async (path: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    await cmd.createFile(vaultPath, path);
    await get().refreshTree();
  },

  createFolder: async (path: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    await cmd.createFolder(vaultPath, path);
    await get().refreshTree();
  },

  deleteFile: async (path: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return;

    // Capture content before deletion for undo (best-effort, files only)
    let savedContent: string | null = null;
    if (path.endsWith('.md')) {
      try { savedContent = await cmd.readFile(vaultPath, path); } catch { /* ignore */ }
    }

    if (useSettingsStore.getState().useTrash) {
      await cmd.trashFile(vaultPath, path);
    } else {
      await cmd.deleteFile(vaultPath, path);
    }
    await get().refreshTree();

    // Show undo toast for file deletions
    if (savedContent !== null) {
      const fileName = path.replace(/\\/g, '/').split('/').pop() ?? path;
      useToastStore.getState().addToast(
        `Deleted "${fileName}"`,
        'info',
        8000,
        {
          label: 'Undo',
          action: async () => {
            try {
              await cmd.createFile(vaultPath, path);
              await cmd.writeFile(vaultPath, path, savedContent!);
              await get().refreshTree();
              useToastStore.getState().addToast(`Restored "${fileName}"`, 'success');
            } catch {
              useToastStore.getState().addToast(`Failed to restore "${fileName}"`, 'error');
            }
          },
        },
      );
    }
  },

  renameFile: async (oldPath: string, newPath: string) => {
    const { vaultPath, backlinkIndex } = get();
    if (!vaultPath) return;
    await cmd.renameFile(vaultPath, oldPath, newPath);

    // Update wiki-links across the vault that reference the old file
    const oldName = oldPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') ?? '';
    const newName = newPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') ?? '';
    if (oldName && newName && oldName !== newName) {
      // Find files that link to the old name
      const linkers = backlinkIndex.get(oldName.toLowerCase());
      if (linkers && linkers.size > 0) {
        // Build regex to match [[oldName]] or [[oldName|alias]]
        const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(\\[\\[)${escaped}(\\]\\]|\\|)`, 'gi');

        // Update all backlinks in parallel instead of serially
        await Promise.all(
          [...linkers]
            .filter((filePath) => filePath !== oldPath)
            .map(async (filePath) => {
              try {
                const text = await cmd.readFile(vaultPath, filePath);
                const replaced = text.replace(re, `$1${newName}$2`);
                if (replaced !== text) {
                  await cmd.writeFile(vaultPath, filePath, replaced);
                }
              } catch {
                // Skip files that can't be read/written
              }
            }),
        );
      }
    }

    await get().refreshTree();
    // Rebuild indices to reflect new links
    await get().buildTagIndex();
  },

  moveFile: async (srcPath: string, destDir: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return null;
    const newPath = await cmd.moveFile(vaultPath, srcPath, destDir);
    await get().refreshTree();
    await get().buildTagIndex();
    return newPath;
  },

  getFolders: () => {
    const { fileTree } = get();
    const folders: string[] = [''];  // root
    const walk = (entries: FileEntry[]) => {
      for (const e of entries) {
        if (e.isDir) {
          folders.push(e.path);
          if (e.children) walk(e.children);
        }
      }
    };
    walk(fileTree);
    return folders;
  },
}));
