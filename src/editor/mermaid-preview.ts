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

// Lazy-load mermaid to avoid large bundle impact
let mermaidPromise: Promise<typeof import('mermaid')> | null = null;
function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
      });
      return m;
    });
  }
  return mermaidPromise;
}

// ── Widget ─────────────────────────────────────────────────

let mermaidIdCounter = 0;

class MermaidWidget extends WidgetType {
  constructor(readonly code: string) {
    super();
  }

  eq(other: MermaidWidget) {
    return this.code === other.code;
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-mermaid-preview';

    const placeholder = document.createElement('div');
    placeholder.className = 'cm-mermaid-loading';
    placeholder.textContent = 'Rendering diagram…';
    wrap.appendChild(placeholder);

    const id = `mermaid-${Date.now()}-${mermaidIdCounter++}`;

    getMermaid()
      .then(async (m) => {
        const { svg } = await m.default.render(id, this.code);
        wrap.innerHTML = svg;
      })
      .catch(() => {
        wrap.textContent = 'Mermaid render error';
        wrap.classList.add('cm-mermaid-error');
      });

    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

// ── Regex ──────────────────────────────────────────────────

const MERMAID_BLOCK_RE = /^```mermaid\s*\n([\s\S]*?)^```\s*$/gm;

// ── Build decorations ──────────────────────────────────────

function buildMermaidDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = view.state.doc;
  const cursor = view.state.selection.main;

  for (const { from, to } of getDecorationRanges(view)) {
    const text = doc.sliceString(from, to);

    MERMAID_BLOCK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MERMAID_BLOCK_RE.exec(text)) !== null) {
      const start = from + match.index;
      const end = from + match.index + match[0].length;
      const code = match[1].trim();
      if (!code) continue;

      // Don't replace if cursor is inside
      if (cursor.from >= start && cursor.to <= end) continue;

      decorations.push(
        Decoration.replace({
          widget: new MermaidWidget(code),
        }).range(start, end),
      );
    }
  }

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

// ── Plugin ─────────────────────────────────────────────────

const MERMAID_PATTERN = /```|mermaid/;

export const mermaidPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private vpBuffer = new ViewportBuffer();
    constructor(view: EditorView) {
      this.decorations = buildMermaidDecorations(view);
      this.vpBuffer.update(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.vpBuffer.reset();
        this.decorations = buildMermaidDecorations(update.view);
        this.vpBuffer.update(update.view);
      } else if (update.viewportChanged) {
        if (this.vpBuffer.needsRebuild(update.view)) {
          this.decorations = buildMermaidDecorations(update.view);
          this.vpBuffer.update(update.view);
        }
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (change && (
          needsRebuildForLine(update.state, this.decorations, change.oldLine, MERMAID_PATTERN) ||
          needsRebuildForLine(update.state, this.decorations, change.newLine, MERMAID_PATTERN)
        )) {
          this.decorations = buildMermaidDecorations(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ── Theme ──────────────────────────────────────────────────

export const mermaidPreviewTheme = EditorView.theme({
  '.cm-mermaid-preview': {
    display: 'flex',
    justifyContent: 'center',
    padding: '12px',
    backgroundColor: 'var(--ctp-mantle)',
    borderRadius: '6px',
    border: '1px solid var(--ctp-surface0)',
    overflow: 'auto',
  },
  '.cm-mermaid-preview svg': {
    maxWidth: '100%',
  },
  '.cm-mermaid-loading': {
    color: 'var(--ctp-overlay1)',
    fontStyle: 'italic',
    padding: '8px',
  },
  '.cm-mermaid-error': {
    color: 'var(--ctp-red)',
    fontStyle: 'italic',
  },
});
