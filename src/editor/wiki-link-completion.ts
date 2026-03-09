import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { quickOpenBus } from '../lib/quick-open-bus';

/**
 * Detects when the user types `[[` and opens the QuickOpen modal in link mode.
 * On selection, replaces the `[[` with `[[chosen-name]]`.
 */
export const wikiLinkCompletion: Extension = EditorView.inputHandler.of(
  (view, from, _to, text) => {
    // We only care about `[` being inserted
    if (text !== '[') return false;

    // Check if the character before the insertion is also `[`
    if (from === 0) return false;
    const charBefore = view.state.sliceDoc(from - 1, from);
    if (charBefore !== '[') return false;

    // We have `[[` — let the `[[` be inserted first, then open the picker
    // Use requestAnimationFrame so the insertion completes before the modal opens
    requestAnimationFrame(() => {
      quickOpenBus.requestLinkPicker((name: string) => {
        // The cursor is after `[[` — insert `name]]`
        const currentView = view;
        const pos = currentView.state.selection.main.head;
        currentView.dispatch({
          changes: { from: pos, to: pos, insert: `${name}]]` },
          selection: { anchor: pos + name.length + 2 },
        });
        currentView.focus();
      });
    });

    // Return false to let the `[` be inserted normally
    return false;
  }
);
