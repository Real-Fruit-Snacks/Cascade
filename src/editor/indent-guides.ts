import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { AccentColor } from '../stores/settings-store';
import type { IndentGuideStyle } from '../stores/settings-store';

/** Currently active guide color CSS value */
let guideColor = 'var(--ctp-lavender)';
let guideStyle: IndentGuideStyle = 'solid';

function makeGradient(): string {
  const color = guideColor;
  if (guideStyle === 'dashed') {
    return `repeating-linear-gradient(to bottom, ${color} 0px, ${color} 4px, transparent 4px, transparent 8px)`;
  }
  if (guideStyle === 'dotted') {
    return `repeating-linear-gradient(to bottom, ${color} 0px, ${color} 2px, transparent 2px, transparent 5px)`;
  }
  // solid
  return `linear-gradient(to bottom, ${color}, ${color})`;
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tabSize = view.state.tabSize;
  const charWidth = view.defaultCharacterWidth;
  const indentWidth = charWidth * tabSize;
  const gradient = makeGradient();

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
        const gradients: string[] = [];
        const positions: string[] = [];
        const sizes: string[] = [];

        for (let i = 0; i < levels; i++) {
          const x = Math.round(indentWidth * (i + 1) - 0.5);
          gradients.push(gradient);
          positions.push(`${x}px 0`);
          sizes.push('1px 100%');
        }

        builder.add(
          line.from,
          line.from,
          Decoration.line({
            attributes: {
              style: [
                `background-image: ${gradients.join(', ')}`,
                `background-position: ${positions.join(', ')}`,
                `background-size: ${sizes.join(', ')}`,
                `background-repeat: no-repeat`,
              ].join('; '),
            },
          }),
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
      if (update.docChanged || update.viewportChanged || update.geometryChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/** Create the indent guides extension with the given color and style. */
export function indentGuides(color: AccentColor, style: string) {
  guideColor = `var(--ctp-${color})`;
  guideStyle = style as IndentGuideStyle;
  return [plugin];
}
