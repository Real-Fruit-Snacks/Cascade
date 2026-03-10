import type { FileEntry } from '../types/index';

/** Flatten a FileEntry tree into a list of all file paths (no dirs). */
export function getAllFilePaths(tree: FileEntry[]): string[] {
  const paths: string[] = [];
  function walk(entries: FileEntry[]) {
    for (const entry of entries) {
      if (entry.isDir) {
        if (entry.children) walk(entry.children);
      } else {
        paths.push(entry.path);
      }
    }
  }
  walk(tree);
  return paths;
}

// Pre-built lookup maps for O(1) resolution instead of O(n) scans
let _cachedFiles: string[] | null = null;
let _exactSet: Set<string> | null = null;
let _lowerMap: Map<string, string> | null = null;
let _baseMap: Map<string, string> | null = null;

function ensureIndex(flatFiles: string[]) {
  if (_cachedFiles === flatFiles) return;
  _cachedFiles = flatFiles;
  _exactSet = new Set(flatFiles);
  _lowerMap = new Map();
  _baseMap = new Map();
  for (const f of flatFiles) {
    const lower = f.toLowerCase();
    if (!_lowerMap.has(lower)) _lowerMap.set(lower, f);
    const base = lower.split('/').pop()!;
    if (!_baseMap.has(base)) _baseMap.set(base, f);
  }
}

/**
 * Split a wiki-link target into file, optional heading anchor, and optional block ID.
 * e.g. "note#heading" → { file: "note", heading: "heading", blockId: null }
 *      "note^abc123"  → { file: "note", heading: null, blockId: "abc123" }
 *      "note"         → { file: "note", heading: null, blockId: null }
 */
export function parseWikiTarget(target: string): { file: string; heading: string | null; blockId: string | null } {
  let file = target;
  let heading: string | null = null;
  let blockId: string | null = null;

  // Check for ^blockid first (can appear after #heading or directly after file)
  const caretIdx = file.indexOf('^');
  if (caretIdx !== -1) {
    blockId = file.slice(caretIdx + 1);
    file = file.slice(0, caretIdx);
  }

  // Check for #heading
  const hashIdx = file.indexOf('#');
  if (hashIdx !== -1) {
    heading = file.slice(hashIdx + 1);
    file = file.slice(0, hashIdx);
  }

  return { file, heading, blockId };
}

/**
 * Resolve a wiki-link target to a file path in the vault.
 * Strips any #heading anchor before resolving.
 * Tries: exact match, with .md, case-insensitive, basename match.
 * Returns the matched path or null if not found.
 */
/** Clear the wiki-link resolution cache. Useful when vault contents change externally. */
export function clearWikiLinkCache() {
  _cachedFiles = null;
  _exactSet = null;
  _lowerMap = null;
  _baseMap = null;
}

export function resolveWikiLink(target: string, flatFiles: string[]): string | null {
  ensureIndex(flatFiles);
  // Strip heading anchor before resolving file path
  const { file } = parseWikiTarget(target);
  const normalized = file.replace(/\\/g, '/');

  // 1. Exact match
  if (_exactSet!.has(normalized)) return normalized;

  // 2. With .md extension
  const withMd = normalized.endsWith('.md') ? normalized : normalized + '.md';
  if (_exactSet!.has(withMd)) return withMd;

  // 2b. With .canvas extension
  const withCanvas = normalized.endsWith('.canvas') ? normalized : normalized + '.canvas';
  if (_exactSet!.has(withCanvas)) return withCanvas;

  // 3. Case-insensitive with .md
  const lowerTarget = withMd.toLowerCase();
  const ciMatch = _lowerMap!.get(lowerTarget);
  if (ciMatch) return ciMatch;

  // 3b. Case-insensitive with .canvas
  const lowerCanvas = (normalized.endsWith('.canvas') ? normalized : normalized + '.canvas').toLowerCase();
  const ciCanvasMatch = _lowerMap!.get(lowerCanvas);
  if (ciCanvasMatch) return ciCanvasMatch;

  // 4. Basename match (for links like [[Note]] matching "subfolder/Note.md")
  const baseName = lowerTarget.split('/').pop()!;
  const baseMatch = _baseMap!.get(baseName);
  if (baseMatch) return baseMatch;

  return null;
}
