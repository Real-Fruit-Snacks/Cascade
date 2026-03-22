/**
 * codemirror-handlers.ts
 *
 * Standalone event-handler factories used by the main editor (use-codemirror.ts).
 * Extracted here to slim down the main hook file.
 *
 * Exports:
 *   - createMousedownHandler()  — suppresses right-click cursor movement
 *   - createUpdateListener()    — debounced content sync + auto-save timer
 */

import { EditorView } from '@codemirror/view';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';

/**
 * Returns a domEventHandlers extension that prevents right-click from moving
 * the cursor or triggering live-preview edit mode.
 */
export function createMousedownHandler() {
  return EditorView.domEventHandlers({
    mousedown(event) {
      if (event.button === 2) return true;
      return false;
    },
  });
}

/**
 * Returns an updateListener extension that:
 *  - debounces content updates to the editor store (100 ms)
 *  - fires auto-save on a timer when the document changes
 */
export function createUpdateListener(
  updateContent: (content: string) => void,
  debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  handleSaveRef: React.MutableRefObject<() => void>,
  contentUpdateTimerRef: { current: ReturnType<typeof setTimeout> | null },
) {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      if (contentUpdateTimerRef.current) clearTimeout(contentUpdateTimerRef.current);
      contentUpdateTimerRef.current = setTimeout(() => {
        const content = update.state.doc.toString();
        updateContent(content);
        contentUpdateTimerRef.current = null;
      }, 100);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      const s = useSettingsStore.getState();
      if (s.autoSaveEnabled && s.autoSaveMode === 'timer') {
        debounceRef.current = setTimeout(() => {
          if (useEditorStore.getState().isDirty) {
            handleSaveRef.current();
          }
        }, s.autoSaveInterval);
      }
    }
  });
}
