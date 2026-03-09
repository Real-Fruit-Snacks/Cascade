import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { syntaxTree, foldedRanges, foldEffect, unfoldEffect } from '@codemirror/language';
import { StateField } from '@codemirror/state';
import type { EditorState, Range } from '@codemirror/state';
import { cursorLineField, getCursorLineChange, needsRebuildForLine } from './cursor-line';
import { useVaultStore } from '../stores/vault-store';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';
import { convertFileSrc } from '@tauri-apps/api/core';
import { PropertiesWidget } from './properties-widget';
import { resolveWikiLink, parseWikiTarget } from '../lib/wiki-link-resolver';
import { readFile } from '../lib/tauri-commands';
import { selectImage, deselectImage, imageSelectionField, parseAltWidth } from './image-controls';

// ── Widgets ────────────────────────────────────────────────

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr');
    hr.className = 'cm-hr-widget';
    return hr;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: CheckboxWidget) {
    return this.checked === other.checked;
  }
  toDOM(view: EditorView) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = this.checked;
    cb.className = 'cm-checkbox-widget';
    cb.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const pos = view.posAtDOM(cb);
      const line = view.state.doc.lineAt(pos);
      const checkMatch = line.text.match(/^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]/);
      if (checkMatch) {
        const bracketPos = line.from + checkMatch[1].length + 1;
        const newChar = this.checked ? ' ' : 'x';
        view.dispatch({
          changes: { from: bracketPos, to: bracketPos + 1, insert: newChar },
        });
      }
    });
    return cb;
  }
}

class TableWidget extends WidgetType {
  constructor(readonly headers: string[], readonly rows: string[][], readonly alignments: ('left' | 'center' | 'right' | null)[]) {
    super();
  }
  eq(other: TableWidget) {
    if (this.headers.length !== other.headers.length || this.rows.length !== other.rows.length) return false;
    for (let i = 0; i < this.headers.length; i++) {
      if (this.headers[i] !== other.headers[i]) return false;
    }
    for (let i = 0; i < this.rows.length; i++) {
      const a = this.rows[i], b = other.rows[i];
      if (a.length !== b.length) return false;
      for (let j = 0; j < a.length; j++) {
        if (a[j] !== b[j]) return false;
      }
    }
    return true;
  }
  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'block';
    const table = document.createElement('table');
    table.className = 'cm-table-widget';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    this.headers.forEach((h, i) => {
      const th = document.createElement('th');
      th.textContent = h.trim();
      if (this.alignments[i]) th.style.textAlign = this.alignments[i]!;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.rows.forEach((row) => {
      const tr = document.createElement('tr');
      row.forEach((cell, i) => {
        const td = document.createElement('td');
        td.textContent = cell.trim();
        if (this.alignments[i]) td.style.textAlign = this.alignments[i]!;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  }
  ignoreEvent() { return false; }
}

/** Parse a markdown table row into cells (splits on | and trims outer pipes). */
function parseTableRow(line: string): string[] {
  const trimmed = line.replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|');
}

/** Parse alignment from delimiter row (e.g. |:---|:---:|---:| ). */
function parseAlignments(line: string): ('left' | 'center' | 'right' | null)[] {
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

// SECURITY: Images (including SVGs) are rendered via <img> tags, which
// prevent script execution in SVG files. Do NOT change to <object>,
// <embed>, <iframe>, or inline SVG without adding SVG sanitization first.
class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly rawUrl: string,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }
  eq(other: ImageWidget) {
    return this.src === other.src && this.from === other.from && this.to === other.to;
  }
  toDOM(view: EditorView) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-image-widget';

    // Check if this image is currently selected
    const sel = view.state.field(imageSelectionField, false);
    if (sel && sel.from === this.from && sel.to === this.to) {
      wrapper.classList.add('cm-image-widget-selected');
    }

    const { alt: cleanAlt, width: pipeWidth, align } = parseAltWidth(this.alt);

    if (align) {
      const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
      wrapper.style.display = 'flex';
      wrapper.style.justifyContent = alignMap[align];
    }

    const img = document.createElement('img');
    img.src = this.src;
    img.alt = cleanAlt;
    img.className = 'cm-image-embed';
    img.draggable = false;
    if (pipeWidth != null) {
      img.style.maxWidth = pipeWidth + 'px';
    }
    img.addEventListener('error', () => {
      wrapper.textContent = `[Image not found: ${this.alt || this.src}]`;
      wrapper.style.color = 'var(--ctp-overlay0)';
      wrapper.style.fontStyle = 'italic';
      wrapper.style.fontSize = '0.85em';
      wrapper.style.padding = '4px 0';
    });

    wrapper.addEventListener('mousedown', (e) => {
      if (this.from === -1) return;
      e.preventDefault();
      e.stopPropagation();
      const currentSel = view.state.field(imageSelectionField, false);
      if (currentSel && currentSel.from === this.from) {
        // Already selected — deselect
        view.dispatch({ effects: deselectImage.of(null) });
      } else {
        // Select this image
        const { alt: parsedAlt, width: parsedWidth, align: parsedAlign } = parseAltWidth(this.alt);
        view.dispatch({
          effects: selectImage.of({
            from: this.from,
            to: this.to,
            src: this.src,
            rawUrl: this.rawUrl,
            alt: parsedAlt,
            pipeWidth: parsedWidth,
            align: parsedAlign,
          }),
        });
      }
    });

    wrapper.appendChild(img);
    return wrapper;
  }
  ignoreEvent() { return true; }
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);

function isImagePath(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTS.has(ext);
}

/** Resolve a vault-relative file path to a convertFileSrc URL. */
function resolveVaultFileSrc(relativePath: string): string | null {
  const vaultPath = useVaultStore.getState().vaultPath;
  if (!vaultPath) return null;
  const normalized = vaultPath.replace(/\\/g, '/');
  const rel = relativePath.replace(/\\/g, '/');
  return convertFileSrc(`${normalized}/${rel}`);
}



/** Extract a heading section from content: from the heading line to the next same-or-higher level heading. */
function extractHeadingSection(content: string, heading: string): string | null {
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
function extractBlockSection(content: string, blockId: string): string | null {
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
const HEADING_STYLES: Record<number, string> = {
  1: 'font-size:2em;line-height:1.4;color:var(--ctp-red);font-weight:bold;margin:0.6em 0 0.3em',
  2: 'font-size:1.6em;line-height:1.4;color:var(--ctp-peach);font-weight:bold;margin:0.5em 0 0.3em',
  3: 'font-size:1.3em;line-height:1.35;color:var(--ctp-yellow);font-weight:bold;margin:0.4em 0 0.2em',
  4: 'font-size:1.15em;line-height:1.35;color:var(--ctp-green);font-weight:bold;margin:0.3em 0 0.2em',
  5: 'font-size:1.05em;color:var(--ctp-blue);font-weight:bold;margin:0.3em 0 0.2em',
  6: 'font-size:1em;color:var(--ctp-mauve);font-weight:bold;margin:0.3em 0 0.2em',
};

/** Render markdown to HTML matching the editor's live preview styles. */
function renderMarkdownPreview(md: string): string {
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

// Track active transclusion chain to detect cycles
const _activeTransclusions = new Set<string>();

class TransclusionWidget extends WidgetType {
  private _dom: HTMLElement | null = null;

  constructor(
    readonly filePath: string,
    readonly linkText: string,
    readonly heading: string | null = null,
    readonly blockId: string | null = null,
  ) {
    super();
  }

  eq(other: TransclusionWidget) {
    return this.filePath === other.filePath && this.linkText === other.linkText
      && this.heading === other.heading && this.blockId === other.blockId;
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-transclusion-widget';

    const header = document.createElement('div');
    header.className = 'cm-transclusion-header';
    let baseName = this.linkText.split('/').pop()?.replace(/\.md$/i, '') ?? this.linkText;
    if (this.heading) baseName += ` > ${this.heading}`;
    header.textContent = baseName;
    wrapper.appendChild(header);

    const body = document.createElement('div');
    body.className = 'cm-transclusion-body';
    body.textContent = 'Loading…';
    wrapper.appendChild(body);

    this._dom = body;

    // Cycle detection
    const key = `${this.filePath}#${this.heading ?? ''}^${this.blockId ?? ''}`;
    if (_activeTransclusions.has(key)) {
      body.textContent = '[Circular embed detected]';
      body.classList.add('cm-transclusion-error');
      return wrapper;
    }

    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath) {
      _activeTransclusions.add(key);
      readFile(vaultPath, this.filePath).then((content) => {
        _activeTransclusions.delete(key);
        if (!this._dom) return;

        let text: string;
        if (this.heading) {
          const section = extractHeadingSection(content, this.heading);
          text = section ?? `[Heading "${this.heading}" not found]`;
        } else if (this.blockId) {
          const block = extractBlockSection(content, this.blockId);
          text = block ?? `[Block "^${this.blockId}" not found]`;
        } else {
          text = content;
        }

        this._dom.innerHTML = renderMarkdownPreview(text);
      }).catch(() => {
        _activeTransclusions.delete(key);
        if (!this._dom) return;
        this._dom.textContent = `[Could not read: ${this.linkText}]`;
        this._dom.classList.add('cm-transclusion-error');
      });
    }

    return wrapper;
  }

  destroy() {
    this._dom = null;
  }

  ignoreEvent() { return false; }
}

/** Resolve an image path to a displayable URL. */
function resolveImageSrc(rawUrl: string): string | null {
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

// ── Code block widgets ────────────────────────────────────

class CopyButtonWidget extends WidgetType {
  constructor(readonly code: string) {
    super();
  }
  eq(other: CopyButtonWidget) {
    return this.code === other.code;
  }
  toDOM() {
    const btn = document.createElement('button');
    btn.className = 'cm-copy-button';
    btn.textContent = 'Copy';
    btn.title = 'Copy to clipboard';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(this.code).then(() => {
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      }).catch(() => {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
    return btn;
  }
  ignoreEvent() { return true; }
}


class CodeLineNumberWidget extends WidgetType {
  constructor(readonly lineNum: number) {
    super();
  }
  eq(other: CodeLineNumberWidget) {
    return this.lineNum === other.lineNum;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-codeblock-line-number';
    span.textContent = String(this.lineNum);
    return span;
  }
}

// ── Callout support ───────────────────────────────────────

const CALLOUT_ICONS: Record<string, string> = {
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
const CALLOUT_COLORS: Record<string, string> = {
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

const CALLOUT_RE = /^\[!(\w+)\]\s*(.*)?$/;

interface CalloutInfo {
  type: string;
  title: string;
  colorClass: string;
}

function parseCallout(state: EditorState, blockFrom: number): CalloutInfo | null {
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

class CalloutHeaderWidget extends WidgetType {
  constructor(
    readonly icon: string,
    readonly title: string,
    readonly colorClass: string,
  ) {
    super();
  }
  eq(other: CalloutHeaderWidget) {
    return this.icon === other.icon && this.title === other.title && this.colorClass === other.colorClass;
  }
  toDOM() {
    const wrapper = document.createElement('span');
    wrapper.className = `cm-callout-header cm-callout-${this.colorClass}`;

    const titleEl = document.createElement('span');
    titleEl.className = 'cm-callout-title';
    titleEl.textContent = this.title;

    wrapper.appendChild(titleEl);
    return wrapper;
  }
}

// ── Frontmatter widget ────────────────────────────────────
// Editable properties editor — see properties-widget.ts

/** Parse YAML frontmatter at the start of the document. Returns null if none found. */
function parseFrontmatter(state: EditorState): { endPos: number; endLine: number; properties: [string, string][] } | null {
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

// ── Helpers ────────────────────────────────────────────────

function cursorOnLines(state: EditorState, from: number, to: number): boolean {
  const head = state.selection.main.head;
  const cursorLine = state.doc.lineAt(head).number;
  const lineFrom = state.doc.lineAt(from).number;
  const lineTo = state.doc.lineAt(to).number;
  return cursorLine >= lineFrom && cursorLine <= lineTo;
}

// ── Build decorations ──────────────────────────────────────

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const deco: Range<Decoration>[] = [];
  const tree = syntaxTree(state);
  const lpSettings = useSettingsStore.getState();

  // ── Frontmatter source styling (widget replacement handled by frontmatterField) ──
  const fm = parseFrontmatter(state);
  if (fm) {
    const fmActive = cursorOnLines(state, 0, fm.endPos);
    if (fmActive || !lpSettings.enableProperties) {
      // Style frontmatter lines when editing
      for (let i = 1; i <= fm.endLine; i++) {
        deco.push(Decoration.line({ class: 'cm-frontmatter-source' }).range(state.doc.line(i).from));
      }
    }
  }

  // Track frontmatter end position so tree iteration can skip those nodes
  const fmEndPos = fm ? fm.endPos : -1;

  // ── Embed transclusions ![[target]] (text-level scan) ──
  const EMBED_RE = /!\[\[([^\]]+)\]\]/g;
  const flatFiles = useVaultStore.getState().flatFiles;

  for (const { from, to } of view.visibleRanges) {
    const text = state.sliceDoc(from, to);
    EMBED_RE.lastIndex = 0;
    let embedMatch: RegExpExecArray | null;
    while ((embedMatch = EMBED_RE.exec(text)) !== null) {
      const matchFrom = from + embedMatch.index;
      const matchTo = matchFrom + embedMatch[0].length;

      // Skip if inside frontmatter
      if (fmEndPos >= 0 && matchFrom <= fmEndPos) continue;

      const target = embedMatch[1];
      const active = cursorOnLines(state, matchFrom, matchTo);

      if (!active) {
        const { heading: embedHeading, blockId: embedBlockId } = parseWikiTarget(target);
        const resolved = resolveWikiLink(target, flatFiles);
        if (resolved && isImagePath(resolved)) {
          const src = resolveVaultFileSrc(resolved);
          if (src) {
            deco.push(
              Decoration.replace({
                widget: new ImageWidget(src, target, target, -1, -1),
              }).range(matchFrom, matchTo)
            );
            continue;
          }
        }
        if (resolved) {
          deco.push(
            Decoration.replace({
              widget: new TransclusionWidget(resolved, target, embedHeading, embedBlockId),
            }).range(matchFrom, matchTo)
          );
        } else {
          // Unresolved embed — style as broken
          deco.push(Decoration.mark({ class: 'cm-embed-broken' }).range(matchFrom, matchTo));
        }
      } else {
        // Cursor on embed line — show source styled
        deco.push(Decoration.mark({ class: 'cm-embed-source' }).range(matchFrom, matchTo));
      }
    }
  }

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(nodeRef) {
        const { from: nFrom, to: nTo, name } = nodeRef;

        // Skip any nodes that overlap with frontmatter (parser misinterprets it)
        if (fmEndPos >= 0 && nFrom <= fmEndPos && name !== 'Document') return false;

        const active = cursorOnLines(state, nFrom, nTo);

        // ── Headers ──
        if (name.startsWith('ATXHeading')) {
          if (!lpSettings.livePreviewHeadings) return;
          const level = parseInt(name.replace('ATXHeading', ''), 10);
          if (level >= 1 && level <= 6) {
            const line = state.doc.lineAt(nFrom);
            deco.push(
              Decoration.line({ class: `cm-heading cm-heading-${level}` }).range(line.from)
            );
            if (!active) {
              const mark = nodeRef.node.getChild('HeaderMark');
              if (mark) {
                let end = mark.to;
                // Also hide the space after the #'s
                if (end < nTo && state.sliceDoc(end, end + 1) === ' ') end++;
                deco.push(Decoration.replace({}).range(mark.from, end));
              }
            }
          }
          return;
        }

        // ── Bold ──
        if (name === 'StrongEmphasis' && lpSettings.livePreviewBold) {
          deco.push(Decoration.mark({ class: 'cm-live-bold' }).range(nFrom, nTo));
          if (!active) {
            for (const m of nodeRef.node.getChildren('EmphasisMark')) {
              deco.push(Decoration.replace({}).range(m.from, m.to));
            }
          }
          return;
        }

        // ── Italic ──
        if (name === 'Emphasis' && lpSettings.livePreviewItalic) {
          deco.push(Decoration.mark({ class: 'cm-live-italic' }).range(nFrom, nTo));
          if (!active) {
            for (const m of nodeRef.node.getChildren('EmphasisMark')) {
              deco.push(Decoration.replace({}).range(m.from, m.to));
            }
          }
          return;
        }

        // ── Inline code ──
        if (name === 'InlineCode') {
          deco.push(Decoration.mark({ class: 'cm-live-code' }).range(nFrom, nTo));
          if (!active) {
            for (const m of nodeRef.node.getChildren('CodeMark')) {
              deco.push(Decoration.replace({}).range(m.from, m.to));
            }
          }
          return;
        }

        // ── Strikethrough ~~text~~ ──
        if (name === 'Strikethrough') {
          deco.push(Decoration.mark({ class: 'cm-live-strikethrough' }).range(nFrom, nTo));
          if (!active) {
            for (const m of nodeRef.node.getChildren('StrikethroughMark')) {
              deco.push(Decoration.replace({}).range(m.from, m.to));
            }
          }
          return;
        }

        // ── Links [text](url) ──
        if (name === 'Link' && lpSettings.livePreviewLinks) {
          deco.push(Decoration.mark({ class: 'cm-live-link' }).range(nFrom, nTo));
          if (!active) {
            const marks = nodeRef.node.getChildren('LinkMark');
            if (marks.length >= 2) {
              // Hide opening [
              deco.push(Decoration.replace({}).range(marks[0].from, marks[0].to));
              // Hide from ] to end of link (covers ](url))
              deco.push(Decoration.replace({}).range(marks[1].from, nTo));
            }
          }
          return;
        }

        // ── Images ![alt](url) ──
        if (name === 'Image' && lpSettings.livePreviewImages) {
          const text = state.sliceDoc(nFrom, nTo);
          const imgMatch = text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
          if (imgMatch) {
            const alt = imgMatch[1];
            const rawUrl = imgMatch[2];
            const src = resolveImageSrc(rawUrl);
            if (src) {
              // Always show image widget — never reveal raw markdown
              deco.push(
                Decoration.replace({
                  widget: new ImageWidget(src, alt, rawUrl, nFrom, nTo),
                }).range(nFrom, nTo)
              );
              return;
            }
          }
          // Fallback for images we can't resolve
          if (!active) {
            deco.push(Decoration.mark({ class: 'cm-live-image' }).range(nFrom, nTo));
            const marks = nodeRef.node.getChildren('LinkMark');
            if (marks.length >= 2) {
              deco.push(Decoration.replace({}).range(nFrom, marks[0].to));
              deco.push(Decoration.replace({}).range(marks[1].from, nTo));
            }
          } else {
            deco.push(Decoration.mark({ class: 'cm-live-image' }).range(nFrom, nTo));
          }
          return;
        }

        // ── Tables ──
        if (name === 'Table') {
          const startLine = state.doc.lineAt(nFrom).number;
          const endLine = state.doc.lineAt(nTo).number;

          if (!active) {
            // Parse the table text into headers, delimiter, and data rows
            const headerLine = state.doc.line(startLine).text;
            const delimiterLine = startLine + 1 <= endLine ? state.doc.line(startLine + 1).text : '';
            const headers = parseTableRow(headerLine);
            const alignments = parseAlignments(delimiterLine);
            const rows: string[][] = [];
            for (let i = startLine + 2; i <= endLine; i++) {
              rows.push(parseTableRow(state.doc.line(i).text));
            }

            // Replace first line with the table widget (single-line replace only)
            const firstLine = state.doc.line(startLine);
            deco.push(
              Decoration.replace({
                widget: new TableWidget(headers, rows, alignments),
              }).range(firstLine.from, firstLine.to)
            );

            // Hide each subsequent line individually (avoids cross-line replace)
            for (let i = startLine + 1; i <= endLine; i++) {
              const line = state.doc.line(i);
              deco.push(Decoration.line({ class: 'cm-table-hidden-line' }).range(line.from));
              if (line.length > 0) {
                deco.push(Decoration.replace({}).range(line.from, line.to));
              }
            }
          } else {
            // When cursor is on the table, style it lightly
            for (let i = startLine; i <= endLine; i++) {
              deco.push(Decoration.line({ class: 'cm-table-source' }).range(state.doc.line(i).from));
            }
          }
          return false;
        }

        // ── Blockquote / Callout ──
        if (name === 'Blockquote') {
          const callout = parseCallout(state, nFrom);
          const startLine = state.doc.lineAt(nFrom).number;
          const endLine = state.doc.lineAt(nTo).number;

          if (callout) {
            // Apply callout styling to every line
            for (let i = startLine; i <= endLine; i++) {
              const classes = [`cm-callout`, `cm-callout-${callout.colorClass}`];
              if (i === startLine) classes.push('cm-callout-first');
              if (i === endLine) classes.push('cm-callout-last');
              deco.push(
                Decoration.line({ class: classes.join(' ') }).range(state.doc.line(i).from)
              );
            }

            if (!active) {
              // Replace entire first line with the callout header widget
              const firstLine = state.doc.lineAt(nFrom);
              const icon = CALLOUT_ICONS[callout.type] ?? 'i';
              deco.push(
                Decoration.replace({
                  widget: new CalloutHeaderWidget(icon, callout.title, callout.colorClass),
                }).range(firstLine.from, firstLine.to)
              );

              // Hide > markers on remaining lines via text scan
              for (let i = startLine + 1; i <= endLine; i++) {
                const line = state.doc.line(i);
                const m = line.text.match(/^>\s?/);
                if (m) {
                  deco.push(Decoration.replace({}).range(line.from, line.from + m[0].length));
                }
              }
            }
          } else {
            // Regular blockquote (no callout)
            for (let i = startLine; i <= endLine; i++) {
              deco.push(
                Decoration.line({ class: 'cm-live-blockquote' }).range(state.doc.line(i).from)
              );
            }
            if (!active) {
              for (let i = startLine; i <= endLine; i++) {
                const line = state.doc.line(i);
                const m = line.text.match(/^>\s?/);
                if (m) {
                  deco.push(Decoration.replace({}).range(line.from, line.from + m[0].length));
                }
              }
            }
          }
          return;
        }

        // ── Horizontal rule ──
        if (name === 'HorizontalRule') {
          if (!active) {
            deco.push(
              Decoration.replace({ widget: new HrWidget() }).range(nFrom, nTo)
            );
          }
          return;
        }

        // ── Task checkbox ──
        if (name === 'TaskMarker') {
          if (!active) {
            const text = state.sliceDoc(nFrom, nTo);
            const checked = text.includes('x') || text.includes('X');
            deco.push(
              Decoration.replace({ widget: new CheckboxWidget(checked) }).range(nFrom, nTo)
            );
          }
          return;
        }

        // ── Fenced code block ──
        if (name === 'FencedCode' && lpSettings.livePreviewCodeBlocks) {
          const startLine = state.doc.lineAt(nFrom).number;
          const endLine = state.doc.lineAt(nTo).number;

          // Skip frontmatter — handled by properties widget
          if (fmEndPos >= 0 && nFrom <= fmEndPos) return;

          // Skip live preview decorations if the block is folded
          // (fold placeholder conflicts with replace decorations)
          let isFolded = false;
          const folds = foldedRanges(state);
          folds.between(nFrom, nTo, () => { isFolded = true; });
          if (isFolded) return;

          for (let i = startLine; i <= endLine; i++) {
            const classes = ['cm-live-codeblock'];
            if (i === startLine) classes.push('cm-codeblock-first');
            if (i === endLine) classes.push('cm-codeblock-last');
            deco.push(
              Decoration.line({ class: classes.join(' ') }).range(state.doc.line(i).from)
            );
          }

          if (!active) {
            // Hide opening fence line (``` or ```lang)
            const openLine = state.doc.line(startLine);
            deco.push(Decoration.replace({}).range(openLine.from, openLine.to));

            // Hide closing fence line
            if (endLine > startLine) {
              const closeLine = state.doc.line(endLine);
              deco.push(Decoration.replace({}).range(closeLine.from, closeLine.to));
            }

            // Add copy button and lang badge on first code line
            const codeStart = startLine + 1;
            const codeEnd = endLine > startLine ? endLine - 1 : endLine;
            if (codeStart <= endLine) {
              // Extract code content
              const codeLines: string[] = [];
              for (let i = codeStart; i <= codeEnd; i++) {
                codeLines.push(state.doc.line(i).text);
              }
              const codeText = codeLines.join('\n');

              // Mark first code line as copy-button anchor
              deco.push(
                Decoration.line({ class: 'cm-codeblock-copy-line' }).range(state.doc.line(codeStart).from)
              );

              // Copy button (top-right of code block)
              deco.push(
                Decoration.widget({
                  widget: new CopyButtonWidget(codeText),
                  side: 1,
                }).range(state.doc.line(codeStart).to)
              );


              // Line numbers (if enabled)
              if (useSettingsStore.getState().codeBlockLineNumbers) {
                let num = 1;
                for (let i = codeStart; i <= codeEnd; i++) {
                  const line = state.doc.line(i);
                  deco.push(
                    Decoration.widget({
                      widget: new CodeLineNumberWidget(num),
                      side: -1,
                    }).range(line.from)
                  );
                  deco.push(
                    Decoration.line({ class: 'cm-codeblock-numbered' }).range(line.from)
                  );
                  num++;
                }
              }
            }
          }
          return;
        }
      },
    });
  }

  return Decoration.set(deco, true);
}

// ── Frontmatter StateField (block decorations require StateField, not ViewPlugin) ──

export const frontmatterField = StateField.define<DecorationSet>({
  create(state) {
    return buildFrontmatterDecorations(state);
  },
  update(decos, tr) {
    if (tr.docChanged) {
      return buildFrontmatterDecorations(tr.state);
    }
    if (tr.selection) {
      // Only rebuild when the cursor moves to a different line
      const oldLine = tr.startState.field(cursorLineField);
      const newLine = tr.state.field(cursorLineField);
      if (oldLine !== newLine) {
        return buildFrontmatterDecorations(tr.state);
      }
    }
    return decos;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

function buildFrontmatterDecorations(state: EditorState): DecorationSet {
  const lpSettings = useSettingsStore.getState();
  if (!lpSettings.enableProperties) return Decoration.none;

  const fm = parseFrontmatter(state);
  if (!fm) return Decoration.none;

  const fmActive = cursorOnLines(state, 0, fm.endPos);
  if (fmActive) return Decoration.none;

  const firstLine = state.doc.line(1);
  const fmEndLine = state.doc.line(fm.endLine);
  return Decoration.set([
    Decoration.replace({
      widget: new PropertiesWidget(fm.properties, firstLine.from, fmEndLine.to),
      block: true,
    }).range(firstLine.from, fmEndLine.to),
  ]);
}

// ── Plugin ─────────────────────────────────────────────────

// Matches any markdown syntax that live-preview decorates
const LIVE_PREVIEW_PATTERN = /[#*_`[!>|~=\-\\]/;

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      // Check if fold state changed (fold/unfold effects)
      const foldChanged = update.transactions.some(tr => tr.effects.some(e => e.is(foldEffect) || e.is(unfoldEffect)));
      if (update.docChanged || update.viewportChanged || foldChanged) {
        this.decorations = buildDecorations(update.view);
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (change && (
          needsRebuildForLine(update.state, this.decorations, change.oldLine, LIVE_PREVIEW_PATTERN) ||
          needsRebuildForLine(update.state, this.decorations, change.newLine, LIVE_PREVIEW_PATTERN)
        )) {
          this.decorations = buildDecorations(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// ── Live preview theme (CSS for decoration classes) ────────

export const livePreviewTheme = EditorView.theme({
  // Frontmatter — source editing mode
  '.cm-line.cm-frontmatter-source': {
    backgroundColor: 'rgba(203,166,247,0.06)',
  },

  // Headers
  '.cm-line.cm-heading': {
    fontWeight: 'bold',
  },
  '.cm-line.cm-heading-1': {
    fontSize: '2em',
    lineHeight: '1.4',
    color: 'var(--ctp-red)',
  },
  '.cm-line.cm-heading-2': {
    fontSize: '1.6em',
    lineHeight: '1.4',
    color: 'var(--ctp-peach)',
  },
  '.cm-line.cm-heading-3': {
    fontSize: '1.3em',
    lineHeight: '1.35',
    color: 'var(--ctp-yellow)',
  },
  '.cm-line.cm-heading-4': {
    fontSize: '1.15em',
    lineHeight: '1.35',
    color: 'var(--ctp-green)',
  },
  '.cm-line.cm-heading-5': {
    fontSize: '1.05em',
    color: 'var(--ctp-blue)',
  },
  '.cm-line.cm-heading-6': {
    fontSize: '1em',
    color: 'var(--ctp-mauve)',
  },

  // Inline
  '.cm-live-bold': {
    fontWeight: 'bold',
  },
  '.cm-live-italic': {
    fontStyle: 'italic',
  },
  '.cm-live-strikethrough': {
    textDecoration: 'line-through',
    color: 'var(--ctp-overlay1)',
  },
  '.cm-live-code': {
    backgroundColor: 'var(--ctp-surface0)',
    borderRadius: '3px',
    padding: '1px 4px',
    fontSize: '0.9em',
  },
  '.cm-live-link': {
    color: 'var(--ctp-blue)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },
  '.cm-live-image': {
    color: 'var(--ctp-teal)',
    fontStyle: 'italic',
  },
  // Tables — rendered widget
  '.cm-table-widget': {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    margin: '8px 0',
    border: '1px solid var(--ctp-surface2)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  '.cm-table-widget th': {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    fontWeight: '600',
    padding: '6px 12px',
    borderBottom: '2px solid var(--ctp-surface2)',
    borderRight: '1px solid var(--ctp-surface2)',
    fontSize: '0.9em',
  },
  '.cm-table-widget th:last-child': {
    borderRight: 'none',
  },
  '.cm-table-widget td': {
    padding: '5px 12px',
    borderBottom: '1px solid var(--ctp-surface1)',
    borderRight: '1px solid var(--ctp-surface1)',
    color: 'var(--ctp-subtext1)',
    fontSize: '0.9em',
  },
  '.cm-table-widget td:last-child': {
    borderRight: 'none',
  },
  '.cm-table-widget tr:last-child td': {
    borderBottom: 'none',
  },
  '.cm-table-widget tbody tr:nth-child(even)': {
    backgroundColor: 'rgba(49,50,68,0.25)',
  },
  '.cm-line.cm-table-hidden-line': {
    height: '0',
    padding: '0',
    margin: '0',
    overflow: 'hidden',
    fontSize: '0',
    lineHeight: '0',
  },
  '.cm-line.cm-frontmatter-hidden': {
    height: '0 !important',
    padding: '0 !important',
    margin: '0 !important',
    overflow: 'hidden',
    fontSize: '0',
    lineHeight: '0 !important',
    border: 'none !important',
    maxHeight: '0 !important',
    minHeight: '0 !important',
  },
  // Tables — source editing mode (cursor on table)
  '.cm-line.cm-table-source': {
    backgroundColor: 'rgba(49,50,68,0.2)',
  },

  '.cm-image-widget': {
    padding: '8px 0',
    display: 'flex',
    justifyContent: 'center',
  },
  '.cm-image-embed': {
    maxWidth: '100%',
    maxHeight: '500px',
    borderRadius: '6px',
    border: '1px solid var(--ctp-surface1)',
  },

  // Block
  '.cm-line.cm-live-blockquote': {
    borderLeft: '3px solid var(--ctp-accent)',
    paddingLeft: '12px',
    color: 'var(--ctp-subtext0)',
  },
  '.cm-line.cm-live-codeblock': {
    backgroundColor: 'var(--ctp-mantle)',
    paddingLeft: '16px',
    paddingRight: '16px',
  },
  '.cm-line.cm-codeblock-first': {
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
    paddingTop: '8px',
  },
  '.cm-line.cm-codeblock-last': {
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
    paddingBottom: '8px',
  },
  '.cm-line.cm-codeblock-numbered': {
    paddingLeft: '44px',
  },
  '.cm-codeblock-line-number': {
    display: 'inline-block',
    width: '32px',
    marginLeft: '-38px',
    marginRight: '4px',
    paddingRight: '8px',
    borderRight: '1px solid var(--ctp-surface1)',
    textAlign: 'right',
    color: 'var(--ctp-overlay0)',
    fontSize: '0.8em',
    opacity: '0.6',
    userSelect: 'none',
    pointerEvents: 'none',
  },

  // Copy button anchor (first code line)
  '.cm-line.cm-codeblock-copy-line': {
    position: 'relative',
  },
  // Copy button (top-right of code block, shown on hover)
  '.cm-copy-button': {
    position: 'absolute',
    right: '8px',
    top: '2px',
    padding: '2px 8px',
    fontSize: '11px',
    fontFamily: 'inherit',
    border: '1px solid var(--ctp-surface2)',
    borderRadius: '4px',
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-subtext0)',
    cursor: 'pointer',
    opacity: '0',
    transition: 'opacity 150ms',
    zIndex: '10',
  },
  '.cm-line.cm-codeblock-copy-line:hover .cm-copy-button': {
    opacity: '1',
  },
  '.cm-copy-button:hover': {
    backgroundColor: 'var(--ctp-surface1)',
    color: 'var(--ctp-text)',
  },

  // Embed transclusions
  '.cm-transclusion-widget': {
    display: 'block',
    margin: '2px 0',
    borderLeft: '2px solid var(--ctp-surface2)',
    paddingLeft: '2px',
    overflow: 'hidden',
  },
  '.cm-transclusion-header': {
    padding: '2px 8px',
    fontSize: '0.7em',
    fontWeight: '500',
    color: 'var(--ctp-overlay0)',
    userSelect: 'none',
    letterSpacing: '0.02em',
  },
  '.cm-transclusion-body': {
    padding: '0 4px 4px',
    fontSize: '1em',
    color: 'var(--ctp-text)',
    whiteSpace: 'normal',
    fontFamily: 'inherit',
    lineHeight: '1.6',
  },
  '.cm-transclusion-error': {
    color: 'var(--ctp-red)',
    fontStyle: 'italic',
  },
  '.cm-embed-broken': {
    color: 'var(--ctp-red)',
    textDecoration: 'underline dashed',
    textUnderlineOffset: '2px',
  },
  '.cm-embed-source': {
    color: 'var(--ctp-mauve)',
    opacity: '0.8',
  },

  // Widgets
  '.cm-hr-widget': {
    border: 'none',
    borderTop: '1px solid var(--ctp-surface2)',
    padding: '8px 0 0 0',
  },
  '.cm-checkbox-widget': {
    verticalAlign: 'middle',
    margin: '0 4px 0 0',
    accentColor: 'var(--ctp-accent)',
  },

  // ── Callouts (full colored box) ──
  '.cm-line.cm-callout': {
    borderLeft: '3px solid var(--ctp-blue)',
    paddingLeft: '16px',
    paddingRight: '16px',
    backgroundColor: 'rgba(137, 180, 250, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-first': {
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
    paddingTop: '6px',
  },
  '.cm-line.cm-callout.cm-callout-last': {
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
    paddingBottom: '6px',
  },
  // Color variants
  '.cm-line.cm-callout.cm-callout-blue': {
    borderLeftColor: 'var(--ctp-blue)',
    backgroundColor: 'rgba(137, 180, 250, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-teal': {
    borderLeftColor: 'var(--ctp-teal)',
    backgroundColor: 'rgba(148, 226, 213, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-green': {
    borderLeftColor: 'var(--ctp-green)',
    backgroundColor: 'rgba(166, 227, 161, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-yellow': {
    borderLeftColor: 'var(--ctp-yellow)',
    backgroundColor: 'rgba(249, 226, 175, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-peach': {
    borderLeftColor: 'var(--ctp-peach)',
    backgroundColor: 'rgba(250, 179, 135, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-red': {
    borderLeftColor: 'var(--ctp-red)',
    backgroundColor: 'rgba(243, 139, 168, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-mauve': {
    borderLeftColor: 'var(--ctp-mauve)',
    backgroundColor: 'rgba(203, 166, 247, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-overlay1': {
    borderLeftColor: 'var(--ctp-overlay1)',
    backgroundColor: 'rgba(147, 153, 178, 0.10)',
  },

  // Callout header widget
  '.cm-callout-header': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 'bold',
  },
  '.cm-callout-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '3px',
    fontSize: '12px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  '.cm-callout-title': {
    textTransform: 'capitalize',
  },
  // Header color variants (icon bg + title color)
  '.cm-callout-header.cm-callout-blue .cm-callout-icon': { backgroundColor: 'rgba(137, 180, 250, 0.25)', color: 'var(--ctp-blue)' },
  '.cm-callout-header.cm-callout-blue .cm-callout-title': { color: 'var(--ctp-blue)' },
  '.cm-callout-header.cm-callout-teal .cm-callout-icon': { backgroundColor: 'rgba(148, 226, 213, 0.25)', color: 'var(--ctp-teal)' },
  '.cm-callout-header.cm-callout-teal .cm-callout-title': { color: 'var(--ctp-teal)' },
  '.cm-callout-header.cm-callout-green .cm-callout-icon': { backgroundColor: 'rgba(166, 227, 161, 0.25)', color: 'var(--ctp-green)' },
  '.cm-callout-header.cm-callout-green .cm-callout-title': { color: 'var(--ctp-green)' },
  '.cm-callout-header.cm-callout-yellow .cm-callout-icon': { backgroundColor: 'rgba(249, 226, 175, 0.25)', color: 'var(--ctp-yellow)' },
  '.cm-callout-header.cm-callout-yellow .cm-callout-title': { color: 'var(--ctp-yellow)' },
  '.cm-callout-header.cm-callout-peach .cm-callout-icon': { backgroundColor: 'rgba(250, 179, 135, 0.25)', color: 'var(--ctp-peach)' },
  '.cm-callout-header.cm-callout-peach .cm-callout-title': { color: 'var(--ctp-peach)' },
  '.cm-callout-header.cm-callout-red .cm-callout-icon': { backgroundColor: 'rgba(243, 139, 168, 0.25)', color: 'var(--ctp-red)' },
  '.cm-callout-header.cm-callout-red .cm-callout-title': { color: 'var(--ctp-red)' },
  '.cm-callout-header.cm-callout-mauve .cm-callout-icon': { backgroundColor: 'rgba(203, 166, 247, 0.25)', color: 'var(--ctp-mauve)' },
  '.cm-callout-header.cm-callout-mauve .cm-callout-title': { color: 'var(--ctp-mauve)' },
  '.cm-callout-header.cm-callout-overlay1 .cm-callout-icon': { backgroundColor: 'rgba(147, 153, 178, 0.25)', color: 'var(--ctp-overlay1)' },
  '.cm-callout-header.cm-callout-overlay1 .cm-callout-title': { color: 'var(--ctp-overlay1)' },
});

// ── Markdown link click handler ─────────────────────────────

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export const markdownLinkClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const line = view.state.doc.lineAt(pos);
    LINK_RE.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = LINK_RE.exec(line.text)) !== null) {
      // Skip image links (preceded by !)
      if (match.index > 0 && line.text[match.index - 1] === '!') continue;

      const matchFrom = line.from + match.index;
      const matchTo = matchFrom + match[0].length;

      if (pos >= matchFrom && pos <= matchTo) {
        const url = match[2];
        event.preventDefault();

        // External URL — open in browser
        if (/^https?:\/\//.test(url)) {
          window.open(url, '_blank', 'noopener');
          return true;
        }

        // Local file link — navigate within vault
        const vaultPath = useVaultStore.getState().vaultPath;
        if (vaultPath) {
          const imageExts = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i;
          if (imageExts.test(url)) return true; // Don't navigate to image files
          const target = url.endsWith('.md') ? url : `${url}.md`;
          const settings = useSettingsStore.getState();
          const forceNewTab = event.ctrlKey || event.metaKey;
          useEditorStore.getState().openFile(vaultPath, target, forceNewTab || settings.wikiLinksOpenInNewTab);
        }
        return true;
      }
    }

    return false;
  },
});
