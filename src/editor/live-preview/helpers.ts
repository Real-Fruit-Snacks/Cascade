import type { EditorState } from '@codemirror/state';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useVaultStore } from '../../stores/vault-store';
import { useEditorStore } from '../../stores/editor-store';
import type { CalloutInfo } from './types';

// ── Image helpers ──────────────────────────────────────────

export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);

export function isImagePath(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTS.has(ext);
}

/** Resolve a vault-relative file path to a convertFileSrc URL. */
export function resolveVaultFileSrc(relativePath: string): string | null {
  const vaultPath = useVaultStore.getState().vaultPath;
  if (!vaultPath) return null;
  const normalized = vaultPath.replace(/\\/g, '/');
  const rel = relativePath.replace(/\\/g, '/');
  return convertFileSrc(`${normalized}/${rel}`);
}

/** Resolve an image path to a displayable URL. */
export function resolveImageSrc(rawUrl: string): string | null {
  // External URLs — pass through
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

  // Relative/local path — resolve against vault root + current file dir
  const vaultPath = useVaultStore.getState().vaultPath;
  const activeFile = useEditorStore.getState().activeFilePath;
  if (!vaultPath) return null;

  // Normalize
  const normalizedVault = vaultPath.replace(/\\/g, '/');

  let resolved: string;
  if (rawUrl.startsWith('/')) {
    // Absolute from vault root
    resolved = `${normalizedVault}${rawUrl}`;
  } else if (rawUrl.startsWith('./') || rawUrl.startsWith('../')) {
    // Explicitly relative to current file's directory
    if (activeFile) {
      const normalized = activeFile.replace(/\\/g, '/');
      const lastSlash = normalized.lastIndexOf('/');
      const dir = lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
      resolved = dir ? `${normalizedVault}/${dir}/${rawUrl}` : `${normalizedVault}/${rawUrl}`;
    } else {
      resolved = `${normalizedVault}/${rawUrl}`;
    }
  } else {
    // Bare path — resolve from vault root (matches Obsidian convention)
    resolved = `${normalizedVault}/${rawUrl}`;
  }

  // Use Tauri's asset protocol to serve local files
  return convertFileSrc(resolved);
}

// ── Table helpers ──────────────────────────────────────────

/** Parse a markdown table row into cells (splits on | and trims outer pipes). */
export function parseTableRow(line: string): string[] {
  const trimmed = line.replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|');
}

/** Parse alignment from delimiter row (e.g. |:---|:---:|---:| ). */
export function parseAlignments(line: string): ('left' | 'center' | 'right' | null)[] {
  return parseTableRow(line).map((cell) => {
    const c = cell.trim();
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });
}

// ── Frontmatter helpers ────────────────────────────────────

/** Parse YAML frontmatter at the start of the document. Returns null if none found. */
export function parseFrontmatter(state: EditorState): { endPos: number; endLine: number; properties: [string, string][] } | null {
  if (state.doc.lines < 3) return null;
  const firstLine = state.doc.line(1);
  if (firstLine.text.trim() !== '---') return null;

  // Search for closing ---
  let endLineNum = -1;
  for (let i = 2; i <= state.doc.lines; i++) {
    if (state.doc.line(i).text.trim() === '---') {
      endLineNum = i;
      break;
    }
  }
  if (endLineNum === -1) return null;

  // Parse YAML lines between the fences
  const properties: [string, string][] = [];
  let currentKey = '';
  let listItems: string[] = [];

  const flushList = () => {
    if (currentKey) {
      if (listItems.length > 0) {
        properties.push([currentKey, `[${listItems.join(', ')}]`]);
        listItems = [];
      } else {
        properties.push([currentKey, '']);
      }
      currentKey = '';
    }
  };

  for (let j = 2; j < endLineNum; j++) {
    const text = state.doc.line(j).text;
    const trimmed = text.trim();
    if (!trimmed) continue;

    // List item (e.g. "  - AWS")
    if (/^\s+-\s+/.test(text)) {
      const item = trimmed.replace(/^-\s+/, '');
      listItems.push(item);
      continue;
    }

    // New key — flush any pending list
    flushList();

    const colonIdx = text.indexOf(':');
    if (colonIdx > 0) {
      const key = text.slice(0, colonIdx).trim();
      const value = text.slice(colonIdx + 1).trim();
      if (value) {
        // Inline value (e.g. "title: Hello" or "tags: [a, b]")
        properties.push([key, value]);
      } else {
        // Key with no inline value — likely a multi-line list follows
        currentKey = key;
      }
    }
  }
  flushList();

  const endLine = state.doc.line(endLineNum);
  return { endPos: endLine.to, endLine: endLineNum, properties };
}

// ── Callout helpers ────────────────────────────────────────

export const CALLOUT_ICONS: Record<string, string> = {
  note: 'i',
  abstract: '=', summary: '=', tldr: '=',
  info: 'i',
  todo: '>',
  tip: '*', hint: '*', important: '*',
  success: '\u2713', check: '\u2713', done: '\u2713',
  question: '?', help: '?', faq: '?',
  warning: '!', caution: '!', attention: '!',
  failure: '\u2717', fail: '\u2717', missing: '\u2717',
  danger: '!!', error: '!!',
  bug: '#',
  example: '\u00BB',
  quote: '\u201C', cite: '\u201C',
};

// Maps callout types to CSS color class suffixes
export const CALLOUT_COLORS: Record<string, string> = {
  note: 'blue', info: 'blue', todo: 'blue',
  abstract: 'teal', summary: 'teal', tldr: 'teal',
  tip: 'teal', hint: 'teal', important: 'teal',
  success: 'green', check: 'green', done: 'green',
  question: 'yellow', help: 'yellow', faq: 'yellow',
  warning: 'peach', caution: 'peach', attention: 'peach',
  failure: 'red', fail: 'red', missing: 'red',
  danger: 'red', error: 'red', bug: 'red',
  example: 'mauve',
  quote: 'overlay1', cite: 'overlay1',
};

export const CALLOUT_RE = /^\[!(\w+)\]\s*(.*)?$/;

export function parseCallout(state: EditorState, blockFrom: number): CalloutInfo | null {
  // Get the first line of the blockquote (skip leading > and space)
  const firstLine = state.doc.lineAt(blockFrom);
  const text = firstLine.text.replace(/^>\s*/, '');
  const match = text.match(CALLOUT_RE);
  if (!match) return null;

  const rawType = match[1].toLowerCase();
  const customTitle = match[2]?.trim();
  const color = CALLOUT_COLORS[rawType] ?? 'blue';
  const title = customTitle || rawType.charAt(0).toUpperCase() + rawType.slice(1);

  return { type: rawType, title, colorClass: color };
}

// ── Transclusion helpers ───────────────────────────────────

/** Extract a heading section from content: from the heading line to the next same-or-higher level heading. */
export function extractHeadingSection(content: string, heading: string): string | null {
  const lines = content.split('\n');
  const target = heading.toLowerCase().replace(/-/g, ' ').trim();
  let startIdx = -1;
  let startLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim().toLowerCase();
      if (startIdx === -1 && text === target) {
        startIdx = i;
        startLevel = level;
      } else if (startIdx !== -1 && level <= startLevel) {
        return lines.slice(startIdx, i).join('\n');
      }
    }
  }

  return startIdx !== -1 ? lines.slice(startIdx).join('\n') : null;
}

/** Extract content around a block ID (^blockid). */
export function extractBlockSection(content: string, blockId: string): string | null {
  const marker = `^${blockId}`;
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.trimEnd().endsWith(marker)) {
      return line.replace(new RegExp(`\\s*\\^${blockId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`), '');
    }
  }
  return null;
}

// Heading colors matching the editor's live preview theme
export const HEADING_STYLES: Record<number, string> = {
  1: 'font-size:2em;line-height:1.4;color:var(--ctp-red);font-weight:bold;margin:0.6em 0 0.3em',
  2: 'font-size:1.6em;line-height:1.4;color:var(--ctp-peach);font-weight:bold;margin:0.5em 0 0.3em',
  3: 'font-size:1.3em;line-height:1.35;color:var(--ctp-yellow);font-weight:bold;margin:0.4em 0 0.2em',
  4: 'font-size:1.15em;line-height:1.35;color:var(--ctp-green);font-weight:bold;margin:0.3em 0 0.2em',
  5: 'font-size:1.05em;color:var(--ctp-blue);font-weight:bold;margin:0.3em 0 0.2em',
  6: 'font-size:1em;color:var(--ctp-mauve);font-weight:bold;margin:0.3em 0 0.2em',
};

/** Render markdown to HTML matching the editor's live preview styles. */
export function renderMarkdownPreview(md: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inline = (text: string): string => {
    let r = escapeHtml(text);
    // Images
    r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;margin:4px 0">');
    // Strikethrough
    r = r.replace(/~~(.+?)~~/g, '<del style="text-decoration:line-through;color:var(--ctp-overlay1)">$1</del>');
    // Bold
    r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic
    r = r.replace(/\*(.+?)\*/g, '<em>$1</em>');
    r = r.replace(/_(.+?)_/g, '<em>$1</em>');
    // Inline code
    r = r.replace(/`([^`]+)`/g, '<code style="background:var(--ctp-surface0);border-radius:3px;padding:1px 4px;font-size:0.9em">$1</code>');
    // Markdown links
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a style="color:var(--ctp-blue);text-decoration:underline;text-underline-offset:2px">$1</a>');
    // Wiki links
    r = r.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_, target, alias) =>
      `<span style="color:var(--ctp-accent);text-decoration:underline;text-underline-offset:2px;cursor:pointer">${alias || target}</span>`);
    // Tags
    r = r.replace(/(^|\s)#([a-zA-Z][\w/-]*)/g, '$1<span style="color:var(--ctp-accent);font-size:0.9em">#$2</span>');
    return r;
  };

  // Strip YAML frontmatter
  let content = md;
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) content = content.slice(end + 4).trim();
  }

  const lines = content.split('\n');
  const out: string[] = [];
  let inCode = false;
  const codeLines: string[] = [];

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        out.push(`<pre style="background:var(--ctp-surface0);padding:0.8em 1em;border-radius:6px;overflow-x:auto;font-size:0.9em;margin:4px 0;line-height:1.5"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines.length = 0;
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.+)/);
    if (h) {
      const level = h[1].length;
      const style = HEADING_STYLES[level] || HEADING_STYLES[6];
      out.push(`<div style="${style}">${inline(h[2])}</div>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      out.push('<hr style="border:none;border-top:1px solid var(--ctp-surface1);margin:1em 0">');
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      out.push(`<div style="border-left:3px solid var(--ctp-overlay0);padding-left:0.8em;color:var(--ctp-overlay1);font-style:italic;margin:2px 0">${inline(line.slice(2))}</div>`);
      continue;
    }

    // Checkbox list
    const cb = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)/);
    if (cb) {
      const indent = Math.floor(cb[1].length / 2);
      out.push(`<div style="margin:1px 0;padding-left:${indent}em;display:flex;align-items:center;gap:4px"><input type="checkbox" disabled ${cb[2] !== ' ' ? 'checked' : ''} style="margin:0"> ${inline(cb[3])}</div>`);
      continue;
    }

    // Unordered list
    const li = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (li) {
      const indent = Math.floor(li[1].length / 2);
      out.push(`<div style="margin:1px 0;padding-left:${indent + 1}em;text-indent:-0.6em">• ${inline(li[2])}</div>`);
      continue;
    }

    // Ordered list
    const ol = line.match(/^(\s*)(\d+)\.\s+(.+)/);
    if (ol) {
      const indent = Math.floor(ol[1].length / 2);
      out.push(`<div style="margin:1px 0;padding-left:${indent + 1}em;text-indent:-1em">${ol[2]}. ${inline(ol[3])}</div>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') { out.push('<div style="height:0.5em"></div>'); continue; }

    // Paragraph
    out.push(`<div style="margin:2px 0">${inline(line)}</div>`);
  }

  if (inCode) {
    out.push(`<pre style="background:var(--ctp-surface0);padding:0.8em 1em;border-radius:6px;overflow-x:auto;font-size:0.9em;margin:4px 0;line-height:1.5"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  return out.join('\n');
}

// ── General helpers ────────────────────────────────────────

export function cursorOnLines(state: EditorState, from: number, to: number): boolean {
  const head = state.selection.main.head;
  const cursorLine = state.doc.lineAt(head).number;
  const lineFrom = state.doc.lineAt(from).number;
  const lineTo = state.doc.lineAt(to).number;
  return cursorLine >= lineFrom && cursorLine <= lineTo;
}
