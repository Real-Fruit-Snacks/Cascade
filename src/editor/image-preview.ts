import { EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { EditorState, Range, StateField, Transaction } from '@codemirror/state';
import { parseAltWidth } from './image-controls';

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly maxHeight: number,
    readonly pipeWidth: number | null = null,
    readonly align: string | null = null,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return this.src === other.src && this.maxHeight === other.maxHeight && this.pipeWidth === other.pipeWidth && this.align === other.align;
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-image-preview';
    wrapper.style.padding = '4px 0';

    if (this.align) {
      const alignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
      wrapper.style.display = 'flex';
      wrapper.style.justifyContent = alignMap[this.align] || 'flex-start';
    }

    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.style.maxWidth = this.pipeWidth != null ? this.pipeWidth + 'px' : '100%';
    img.style.maxHeight = this.maxHeight + 'px';
    img.style.borderRadius = '4px';
    img.style.display = 'block';
    img.draggable = false;

    img.onerror = () => {
      wrapper.style.display = 'none';
    };

    wrapper.appendChild(img);
    return wrapper;
  }

  ignoreEvent() {
    return true;
  }
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function buildDecorations(state: EditorState, maxHeight: number): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const cursor = state.selection.main.head;

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    IMAGE_RE.lastIndex = 0;
    let match;

    while ((match = IMAGE_RE.exec(line.text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;

      // Don't replace if cursor is inside the image syntax
      if (cursor >= start && cursor <= end) continue;

      // Only handle images that are on their own line
      if (line.text.trim() !== match[0]) continue;

      const { alt: cleanAlt, width: pipeWidth, align } = parseAltWidth(match[1]);
      const src = match[2];

      decos.push(
        Decoration.widget({
          widget: new ImageWidget(src, cleanAlt, maxHeight, pipeWidth, align),
          block: true,
        }).range(end)
      );
    }
  }

  return Decoration.set(decos, true);
}

export function imagePreview(maxHeight = 300) {
  return [
    StateField.define<DecorationSet>({
      create(state) {
        return buildDecorations(state, maxHeight);
      },
      update(decos, tr: Transaction) {
        if (tr.docChanged || tr.selection) {
          return buildDecorations(tr.state, maxHeight);
        }
        return decos;
      },
      provide(field) {
        return EditorView.decorations.from(field);
      },
    }),
    EditorView.baseTheme({
      '.cm-image-preview': {
        userSelect: 'none',
      },
      '.cm-image-preview img': {
        opacity: '0.9',
        transition: 'opacity 150ms',
      },
      '.cm-image-preview img:hover': {
        opacity: '1',
      },
    }),
  ];
}
