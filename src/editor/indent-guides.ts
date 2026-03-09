import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { AccentColor } from '../stores/settings-store';

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tabSize = view.state.tabSize;

  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text;

      // Count leading whitespace
      let indent = 0;
      for (const ch of text) {
        if (ch === ' ') indent++;
        else if (ch === '\t') indent += tabSize;
        else break;
      }

      const levels = Math.floor(indent / tabSize);
      if (levels > 0 && text.trim().length > 0) {
        builder.add(
          line.from,
          line.from,
          Decoration.line({ attributes: { 'data-indent-levels': String(levels) } }),
        );
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/** Create the indent guides extension with the given color and style. */
export function indentGuides(color: AccentColor, style: string) {
  const borderStyle = `1px ${style} var(--ctp-${color})`;

  const guideTheme = EditorView.theme({
    '.cm-line[data-indent-levels]': {
      '--indent-guide-border': borderStyle,
    },
  });

  return [plugin, guideTheme, indentGuideBaseTheme];
}

/** Base theme for indent guide rendering using pseudo-elements can't work in CM6,
 *  so we use a background-image approach instead. */
const indentGuideBaseTheme = EditorView.baseTheme({
  '.cm-line[data-indent-levels]': {
    backgroundRepeat: 'no-repeat',
  },
});
