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
import { ViewportBuffer, getDecorationRanges } from './viewport-buffer';

// ── Regex ──────────────────────────────────────────────────

// Inline footnote reference: [^id]
const FOOTNOTE_REF_RE = /\[\^([^\]]+)\]/g;
// Footnote definition: [^id]: content (at start of line)
const FOOTNOTE_DEF_RE = /^\[\^([^\]]+)\]:\s*(.*)/;
// Continuation line: indented line with non-whitespace content
const CONTINUATION_RE = /^\s+\S/;

// ── Widgets ────────────────────────────────────────────────

class FootnoteRefWidget extends WidgetType {
  constructor(readonly id: string) {
    super();
  }

  eq(other: FootnoteRefWidget) {
    return this.id === other.id;
  }

  toDOM() {
    const sup = document.createElement('sup');
    sup.className = 'cm-footnote-ref';
    sup.textContent = this.id;
    sup.title = `Footnote ${this.id}`;
    return sup;
  }

  ignoreEvent() {
    return false;
  }
}

class FootnoteDefWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly content: string,
  ) {
    super();
  }

  eq(other: FootnoteDefWidget) {
    return this.id === other.id && this.content === other.content;
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-footnote-def';

    const label = document.createElement('span');
    label.className = 'cm-footnote-def-label';
    label.textContent = this.id;
    wrap.appendChild(label);

    const text = document.createElement('span');
    text.className = 'cm-footnote-def-content';
    text.textContent = this.content;
    wrap.appendChild(text);

    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

// ── Build decorations ──────────────────────────────────────

function buildFootnoteDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = view.state.doc;
  const cursor = view.state.selection.main;

  for (const { from, to } of getDecorationRanges(view)) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);

      // Check for footnote definition first
      const defMatch = line.text.match(FOOTNOTE_DEF_RE);
      if (defMatch) {
        const start = line.from;
        const end = line.to;

        // Collect continuation lines (indented lines following the definition)
        let content = defMatch[2];
        let blockEnd = end;
        let nextNum = line.number + 1;
        while (nextNum <= doc.lines) {
          const nextLine = doc.line(nextNum);
          if (CONTINUATION_RE.test(nextLine.text) && !nextLine.text.match(FOOTNOTE_DEF_RE)) {
            content += ' ' + nextLine.text.trim();
            blockEnd = nextLine.to;
            nextNum++;
          } else {
            break;
          }
        }

        if (cursor.from < start || cursor.from > blockEnd) {
          decorations.push(
            Decoration.replace({
              widget: new FootnoteDefWidget(defMatch[1], content),
            }).range(start, blockEnd),
          );
        }

        pos = blockEnd + 1;
        continue;
      }

      // Inline footnote references
      FOOTNOTE_REF_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = FOOTNOTE_REF_RE.exec(line.text)) !== null) {
        // Skip if this is a definition line start
        if (match.index === 0 && line.text[match[0].length] === ':') continue;

        const start = line.from + match.index;
        const end = start + match[0].length;

        if (cursor.from >= start && cursor.to <= end) continue;

        decorations.push(
          Decoration.replace({
            widget: new FootnoteRefWidget(match[1]),
          }).range(start, end),
        );
      }

      pos = line.to + 1;
    }
  }

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

// ── Plugin ─────────────────────────────────────────────────

const FOOTNOTE_PATTERN = /\[\^/;

export const footnotePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private vpBuffer = new ViewportBuffer();
    constructor(view: EditorView) {
      this.decorations = buildFootnoteDecorations(view);
      this.vpBuffer.update(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.vpBuffer.reset();
        this.decorations = buildFootnoteDecorations(update.view);
        this.vpBuffer.update(update.view);
      } else if (update.viewportChanged) {
        if (this.vpBuffer.needsRebuild(update.view)) {
          this.decorations = buildFootnoteDecorations(update.view);
          this.vpBuffer.update(update.view);
        }
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (change && (
          needsRebuildForLine(update.state, this.decorations, change.oldLine, FOOTNOTE_PATTERN) ||
          needsRebuildForLine(update.state, this.decorations, change.newLine, FOOTNOTE_PATTERN)
        )) {
          this.decorations = buildFootnoteDecorations(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ── Theme ──────────────────────────────────────────────────

export const footnotePreviewTheme = EditorView.theme({
  '.cm-footnote-ref': {
    color: 'var(--ctp-accent)',
    cursor: 'pointer',
    fontSize: '0.8em',
    verticalAlign: 'super',
    padding: '0 1px',
    borderBottom: '1px dotted var(--ctp-accent)',
  },
  '.cm-footnote-ref:hover': {
    backgroundColor: 'color-mix(in srgb, var(--ctp-accent) 15%, transparent)',
    borderRadius: '2px',
  },
  '.cm-footnote-def': {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    padding: '4px 8px',
    margin: '2px 0',
    borderLeft: '2px solid var(--ctp-overlay0)',
    backgroundColor: 'var(--ctp-mantle)',
    borderRadius: '0 4px 4px 0',
    fontSize: '0.9em',
  },
  '.cm-footnote-def-label': {
    color: 'var(--ctp-accent)',
    fontWeight: '600',
    fontSize: '0.85em',
    flexShrink: '0',
    '&::before': { content: '"["' },
    '&::after': { content: '"]"' },
  },
  '.cm-footnote-def-content': {
    color: 'var(--ctp-subtext0)',
  },
});
