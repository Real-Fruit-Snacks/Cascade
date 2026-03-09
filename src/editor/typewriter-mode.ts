import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { getCursorLineChange } from './cursor-line';

/**
 * Typewriter mode: keeps the cursor vertically centered in the editor.
 * `offset` is a percentage (0–100) controlling where the cursor sits — 50 = center.
 */
export function typewriterMode(offset = 50) {
  let rafId = 0;
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        // Always re-center on doc change (text reflow may shift cursor vertically)
        // For selection-only changes, only re-center when cursor moves to a new line
        if (!update.docChanged) {
          if (!update.selectionSet) return;
          const change = getCursorLineChange(update);
          if (!change) return;
        }

        const view = update.view;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const cursor = view.state.selection.main.head;
          const coords = view.coordsAtPos(cursor);
          if (!coords) return;

          const editorRect = view.scrollDOM.getBoundingClientRect();
          const targetY = editorRect.top + editorRect.height * (offset / 100);
          const diff = coords.top - targetY;
          if (Math.abs(diff) > 2) {
            view.scrollDOM.scrollBy({ top: diff, behavior: 'auto' });
          }
        });
      }
    },
  );
}

/** Extra bottom padding so the last line can scroll to center. */
export const typewriterPadding = EditorView.theme({
  '.cm-content': { paddingBottom: '40vh' },
});

/** Focus mode: dim all lines except the active one. */
export const focusMode = EditorView.theme({
  '&.cm-focused .cm-line': {
    opacity: '0.3',
    transition: 'opacity 0.15s ease',
  },
  '&.cm-focused .cm-activeLine': {
    opacity: '1',
  },
});
