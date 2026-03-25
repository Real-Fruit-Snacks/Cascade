import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import type { Range } from '@codemirror/state';
import type { AccentColor } from '../stores/settings-store';
import { getCursorLineChange, needsRebuildForLine } from './cursor-line';
import { ViewportBuffer, getDecorationRanges } from './viewport-buffer';

// Matches ==text== on a single line (non-greedy, no newlines inside)
const HIGHLIGHT_RE = /==[^\n=]+?==/g;

// Pre-built decorations
const delimHideDeco = Decoration.replace({});
const contentDeco = Decoration.mark({ class: 'cm-highlight' });

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const editable = state.facet(EditorView.editable);
  const cursorHead = state.selection.main.head;
  const deco: Range<Decoration>[] = [];

  for (const { from, to } of getDecorationRanges(view)) {
    const text = state.sliceDoc(from, to);
    let m: RegExpExecArray | null;
    HIGHLIGHT_RE.lastIndex = 0;

    while ((m = HIGHLIGHT_RE.exec(text)) !== null) {
      const matchFrom = from + m.index;
      const matchTo = matchFrom + m[0].length;
      const openDelimFrom = matchFrom;
      const openDelimTo = matchFrom + 2;
      const closeDelimFrom = matchTo - 2;
      const closeDelimTo = matchTo;
      const innerFrom = openDelimTo;
      const innerTo = closeDelimFrom;

      // Reveal delimiters when cursor is inside this highlight span
      // In reading mode, never reveal source
      const cursorInside = editable && cursorHead >= matchFrom && cursorHead <= matchTo;

      if (!cursorInside) {
        deco.push(delimHideDeco.range(openDelimFrom, openDelimTo));
        deco.push(contentDeco.range(innerFrom, innerTo));
        deco.push(delimHideDeco.range(closeDelimFrom, closeDelimTo));
      }
    }
  }

  // Sort by range start (required by CodeMirror)
  deco.sort((a, b) => a.from - b.from);

  return Decoration.set(deco, true);
}

const HIGHLIGHT_PATTERN = /==/;

export const highlightSyntax = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private vpBuffer = new ViewportBuffer();
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
      this.vpBuffer.update(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.vpBuffer.reset();
        this.decorations = buildDecorations(update.view);
        this.vpBuffer.update(update.view);
      } else if (update.viewportChanged) {
        if (this.vpBuffer.needsRebuild(update.view)) {
          this.decorations = buildDecorations(update.view);
          this.vpBuffer.update(update.view);
        }
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (change && (
          needsRebuildForLine(update.state, this.decorations, change.oldLine, HIGHLIGHT_PATTERN) ||
          needsRebuildForLine(update.state, this.decorations, change.newLine, HIGHLIGHT_PATTERN)
        )) {
          this.decorations = buildDecorations(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export function highlightSyntaxTheme(color: AccentColor) {
  return EditorView.baseTheme({
    '.cm-highlight': {
      backgroundColor: `color-mix(in srgb, var(--ctp-${color}) 25%, transparent)`,
      borderRadius: '2px',
      padding: '1px 0',
    },
  });
}
