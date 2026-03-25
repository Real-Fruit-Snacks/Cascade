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
let katexPromise: Promise<typeof import('katex')> | null = null;
function getKatex() {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css' as string),
    ]).then(([katexModule]) => katexModule);
  }
  return katexPromise;
}

// ── Widgets ────────────────────────────────────────────────

class MathWidget extends WidgetType {
  constructor(
    readonly latex: string,
    readonly displayMode: boolean,
  ) {
    super();
  }

  eq(other: MathWidget) {
    return this.latex === other.latex && this.displayMode === other.displayMode;
  }

  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = this.displayMode ? 'cm-math-block' : 'cm-math-inline';
    wrap.textContent = this.latex; // placeholder while loading
    getKatex().then((katexModule) => {
      try {
        katexModule.default.render(this.latex, wrap, {
          displayMode: this.displayMode,
          throwOnError: false,
          output: 'htmlAndMathml',
        });
      } catch {
        wrap.textContent = this.latex;
        wrap.classList.add('cm-math-error');
      }
    }).catch(() => {
      wrap.textContent = this.latex;
      wrap.classList.add('cm-math-error');
    });
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

// ── Regex patterns ─────────────────────────────────────────

// Block math: $$...$$ (must be on own lines or span multiple lines)
const BLOCK_MATH_RE = /\$\$\n?([\s\S]*?)\n?\$\$/g;
// Inline math: $...$ (not preceded/followed by $, content non-empty, no newlines)
const INLINE_MATH_RE = /(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g;

// ── Build decorations ──────────────────────────────────────

function buildMathDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = view.state.doc;
  const cursor = view.state.selection.main;

  for (const { from, to } of getDecorationRanges(view)) {
    const text = doc.sliceString(from, to);

    // Block math $$...$$
    BLOCK_MATH_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BLOCK_MATH_RE.exec(text)) !== null) {
      const start = from + match.index;
      const end = from + match.index + match[0].length;
      const latex = match[1].trim();
      if (!latex) continue;

      // Don't replace if cursor is inside
      if (cursor.from >= start && cursor.to <= end) continue;

      decorations.push(
        Decoration.replace({
          widget: new MathWidget(latex, true),
        }).range(start, end),
      );
    }

    // Inline math $...$
    INLINE_MATH_RE.lastIndex = 0;
    while ((match = INLINE_MATH_RE.exec(text)) !== null) {
      const start = from + match.index;
      const end = from + match.index + match[0].length;
      const latex = match[1].trim();
      if (!latex) continue;

      // Don't replace if cursor is inside
      if (cursor.from >= start && cursor.to <= end) continue;

      decorations.push(
        Decoration.replace({
          widget: new MathWidget(latex, false),
        }).range(start, end),
      );
    }
  }

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

// ── Plugin ─────────────────────────────────────────────────

const MATH_PATTERN = /\$/;

export const mathPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private vpBuffer = new ViewportBuffer();
    constructor(view: EditorView) {
      this.decorations = buildMathDecorations(view);
      this.vpBuffer.update(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.vpBuffer.reset();
        this.decorations = buildMathDecorations(update.view);
        this.vpBuffer.update(update.view);
      } else if (update.viewportChanged) {
        if (this.vpBuffer.needsRebuild(update.view)) {
          this.decorations = buildMathDecorations(update.view);
          this.vpBuffer.update(update.view);
        }
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (change && (
          needsRebuildForLine(update.state, this.decorations, change.oldLine, MATH_PATTERN) ||
          needsRebuildForLine(update.state, this.decorations, change.newLine, MATH_PATTERN)
        )) {
          this.decorations = buildMathDecorations(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ── Theme ──────────────────────────────────────────────────

export const mathPreviewTheme = EditorView.theme({
  '.cm-math-inline': {
    padding: '0 2px',
  },
  '.cm-math-block': {
    display: 'block',
    textAlign: 'center',
    padding: '8px 0',
  },
  '.cm-math-error': {
    color: 'var(--ctp-red)',
    fontStyle: 'italic',
  },
});
