import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { getCursorLineChange, needsRebuildForLine } from './cursor-line';
import { useVaultStore } from '../stores/vault-store';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';
import { resolveWikiLink, parseWikiTarget } from '../lib/wiki-link-resolver';
import { readFile } from '../lib/tauri-commands';

// ── Regex ───────────────────────────────────────────────────
// Matches ![[filename]] and ![[filename#heading]]
const EMBED_RE = /!\[\[([^\]]+?)\]\]/g;

// ── Heading extraction ──────────────────────────────────────

function extractHeadingSection(content: string, heading: string): string {
  const lines = content.split('\n');
  let inSection = false;
  let sectionLevel = 0;
  const result: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      if (!inSection) {
        if (title.toLowerCase() === heading.toLowerCase()) {
          inSection = true;
          sectionLevel = level;
          result.push(line);
        }
      } else {
        if (level <= sectionLevel) {
          break;
        }
        result.push(line);
      }
    } else if (inSection) {
      result.push(line);
    }
  }

  return result.join('\n').trim();
}

// ── Simple markdown-to-HTML renderer ───────────────────────
// Lightweight renderer sufficient for embedded note previews.

function renderMarkdown(md: string, depth: number): string {
  // Strip YAML frontmatter
  let text = md.replace(/^---[\s\S]*?^---\s*/m, '');

  // Strip nested embeds to avoid recursion beyond depth limit
  if (depth >= 2) {
    text = text.replace(/!\[\[[^\]]+\]\]/g, '<em class="cm-embed-nested">[embed]</em>');
  }

  const lines = text.split('\n');
  const htmlLines: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    const fenceMatch = line.match(/^```(\w*)$/);
    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = fenceMatch[1];
        codeLines = [];
      } else {
        inCodeBlock = false;
        const escaped = codeLines.map(l => escapeHtml(l)).join('\n');
        htmlLines.push(`<pre class="cm-embed-code"><code${codeLang ? ` class="language-${codeLang}"` : ''}>${escaped}</code></pre>`);
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      htmlLines.push(`<h${level} class="cm-embed-h${level}">${inlineMarkdown(hMatch[2])}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      htmlLines.push('<hr class="cm-embed-hr">');
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      htmlLines.push(`<blockquote class="cm-embed-blockquote">${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }

    // Unordered list item
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      htmlLines.push(`<li class="cm-embed-li">${inlineMarkdown(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      htmlLines.push(`<li class="cm-embed-li">${inlineMarkdown(olMatch[2])}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      htmlLines.push('<br>');
      continue;
    }

    // Paragraph
    htmlLines.push(`<p class="cm-embed-p">${inlineMarkdown(line)}</p>`);
  }

  if (inCodeBlock && codeLines.length > 0) {
    const escaped = codeLines.map(l => escapeHtml(l)).join('\n');
    htmlLines.push(`<pre class="cm-embed-code"><code>${escaped}</code></pre>`);
  }

  return htmlLines.join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text: string): string {
  let out = escapeHtml(text);
  // Bold+italic
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/_(.+?)_/g, '<em>$1</em>');
  // Inline code
  out = out.replace(/`(.+?)`/g, '<code class="cm-embed-inline-code">$1</code>');
  // Strikethrough
  out = out.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Highlight
  out = out.replace(/==(.+?)==/g, '<mark>$1</mark>');
  // Markdown links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Wiki links [[target]] — show as plain text in embeds
  out = out.replace(/\[\[([^\]]+)\]\]/g, '<span class="cm-embed-wikilink">$1</span>');
  return out;
}

// ── Widget ──────────────────────────────────────────────────

class EmbedWidget extends WidgetType {
  constructor(
    readonly target: string,
    readonly heading: string | null,
    readonly resolvedPath: string | null,
    readonly depth: number,
  ) {
    super();
  }

  eq(other: EmbedWidget): boolean {
    return (
      this.target === other.target &&
      this.heading === other.heading &&
      this.resolvedPath === other.resolvedPath &&
      this.depth === other.depth
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-embed-widget';
    wrapper.setAttribute('data-embed-target', this.target);

    if (!this.resolvedPath) {
      wrapper.classList.add('cm-embed-broken');
      const icon = document.createElement('span');
      icon.className = 'cm-embed-broken-icon';
      icon.textContent = '⚠';
      const label = document.createElement('span');
      label.textContent = `Note not found: ${this.target}`;
      wrapper.appendChild(icon);
      wrapper.appendChild(label);
      return wrapper;
    }

    // Header bar
    const header = document.createElement('div');
    header.className = 'cm-embed-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'cm-embed-title';
    const displayName = this.resolvedPath.split('/').pop()?.replace(/\.md$/, '') ?? this.target;
    titleEl.textContent = this.heading ? `${displayName} § ${this.heading}` : displayName;

    const linkBtn = document.createElement('button');
    linkBtn.className = 'cm-embed-link-btn';
    linkBtn.title = 'Open note';
    linkBtn.textContent = '↗';
    linkBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const vaultPath = useVaultStore.getState().vaultPath;
      if (!vaultPath || !this.resolvedPath) return;
      const settings = useSettingsStore.getState();
      if (this.heading) {
        useEditorStore.setState({ pendingScrollHeading: this.heading });
      }
      useEditorStore.getState().openFile(vaultPath, this.resolvedPath, settings.wikiLinksOpenInNewTab);
    });

    header.appendChild(titleEl);
    header.appendChild(linkBtn);
    wrapper.appendChild(header);

    // Content area — starts empty, fills async
    const content = document.createElement('div');
    content.className = 'cm-embed-content';
    content.textContent = 'Loading…';
    wrapper.appendChild(content);

    this._loadContent(content, view);

    return wrapper;
  }

  private _loadContent(content: HTMLElement, _view: EditorView): void {
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath || !this.resolvedPath) return;

    readFile(vaultPath, this.resolvedPath)
      .then((text) => {
        let body = text;
        if (this.heading) {
          body = extractHeadingSection(text, this.heading);
          if (!body) {
            content.innerHTML = `<em class="cm-embed-missing-heading">Heading "${this.heading}" not found</em>`;
            return;
          }
        }
        const html = renderMarkdown(body, this.depth);
        content.innerHTML = html || '<em class="cm-embed-empty">Empty note</em>';
      })
      .catch(() => {
        content.innerHTML = '<em class="cm-embed-error">Could not read note</em>';
      });
  }

  ignoreEvent(event: Event): boolean {
    // Allow mousedown on the link button to propagate through our handler
    return event.type !== 'mousedown';
  }


}

// ── Build decorations ───────────────────────────────────────

function cursorOnLine(view: EditorView, from: number, to: number): boolean {
  const head = view.state.selection.main.head;
  const cursorLine = view.state.doc.lineAt(head).number;
  const lineFrom = view.state.doc.lineAt(from).number;
  const lineTo = view.state.doc.lineAt(to).number;
  return cursorLine >= lineFrom && cursorLine <= lineTo;
}

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const deco: Range<Decoration>[] = [];
  const flatFiles = useVaultStore.getState().flatFiles;

  for (const { from, to } of view.visibleRanges) {
    const text = state.sliceDoc(from, to);
    EMBED_RE.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = EMBED_RE.exec(text)) !== null) {
      const matchFrom = from + match.index;
      const matchTo = matchFrom + match[0].length;

      // Show raw syntax when cursor is on the same line
      if (cursorOnLine(view, matchFrom, matchTo)) continue;

      const target = match[1];
      const { file: fileTarget, heading } = parseWikiTarget(target);
      const resolvedPath = resolveWikiLink(fileTarget, flatFiles);

      // Replace the entire ![[...]] span with the widget
      deco.push(
        Decoration.replace({
          widget: new EmbedWidget(target, heading, resolvedPath, 0),
          block: true,
        }).range(matchFrom, matchTo),
      );
    }
  }

  return Decoration.set(deco, true);
}

// ── Plugin ──────────────────────────────────────────────────

const EMBED_PATTERN = /!\[\[/;

export const embedPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (
          change &&
          (needsRebuildForLine(update.state, this.decorations, change.oldLine, EMBED_PATTERN) ||
            needsRebuildForLine(update.state, this.decorations, change.newLine, EMBED_PATTERN))
        ) {
          this.decorations = buildDecorations(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ── Theme ───────────────────────────────────────────────────

export const embedPreviewTheme = EditorView.theme({
  '.cm-embed-widget': {
    display: 'block',
    margin: '6px 0',
    borderRadius: '6px',
    border: '1px solid var(--ctp-surface1)',
    background: 'var(--ctp-surface0)',
    overflow: 'hidden',
    fontSize: '0.92em',
    userSelect: 'none',
  },
  '.cm-embed-header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 10px',
    borderBottom: '1px solid var(--ctp-surface1)',
    background: 'var(--ctp-surface1)',
  },
  '.cm-embed-title': {
    fontWeight: '600',
    color: 'var(--ctp-subtext1)',
    fontSize: '0.85em',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '.cm-embed-link-btn': {
    background: 'none',
    border: 'none',
    color: 'var(--ctp-blue)',
    cursor: 'pointer',
    fontSize: '1em',
    padding: '0 2px',
    lineHeight: '1',
    flexShrink: '0',
    opacity: '0.7',
    transition: 'opacity 150ms',
  },
  '.cm-embed-link-btn:hover': {
    opacity: '1',
  },
  '.cm-embed-content': {
    padding: '8px 12px',
    color: 'var(--ctp-text)',
    maxHeight: '400px',
    overflowY: 'auto',
    lineHeight: '1.6',
  },
  '.cm-embed-content p.cm-embed-p': {
    margin: '0 0 0.4em',
  },
  '.cm-embed-content h1.cm-embed-h1, .cm-embed-content h2.cm-embed-h2, .cm-embed-content h3.cm-embed-h3, .cm-embed-content h4.cm-embed-h4, .cm-embed-content h5.cm-embed-h5, .cm-embed-content h6.cm-embed-h6': {
    margin: '0.3em 0 0.2em',
    color: 'var(--ctp-text)',
  },
  '.cm-embed-content pre.cm-embed-code': {
    background: 'var(--ctp-base)',
    borderRadius: '4px',
    padding: '6px 8px',
    overflowX: 'auto',
    fontSize: '0.88em',
    margin: '0.3em 0',
  },
  '.cm-embed-content code.cm-embed-inline-code': {
    background: 'var(--ctp-base)',
    borderRadius: '3px',
    padding: '0 3px',
    fontSize: '0.88em',
  },
  '.cm-embed-content blockquote.cm-embed-blockquote': {
    borderLeft: '3px solid var(--ctp-surface2)',
    margin: '0.3em 0 0.3em 4px',
    paddingLeft: '8px',
    color: 'var(--ctp-subtext0)',
  },
  '.cm-embed-content li.cm-embed-li': {
    marginLeft: '1.2em',
    listStyleType: 'disc',
  },
  '.cm-embed-content hr.cm-embed-hr': {
    border: 'none',
    borderTop: '1px solid var(--ctp-surface1)',
    margin: '0.5em 0',
  },
  '.cm-embed-content .cm-embed-wikilink': {
    color: 'var(--ctp-blue)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  '.cm-embed-content .cm-embed-nested': {
    color: 'var(--ctp-overlay0)',
    fontSize: '0.85em',
  },
  '.cm-embed-broken': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    color: 'var(--ctp-red)',
    fontSize: '0.88em',
  },
  '.cm-embed-broken-icon': {
    fontSize: '1.1em',
  },
  '.cm-embed-missing-heading, .cm-embed-empty, .cm-embed-error': {
    color: 'var(--ctp-overlay0)',
    fontSize: '0.88em',
    fontStyle: 'italic',
  },
});
