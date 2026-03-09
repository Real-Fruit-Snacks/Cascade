/**
 * Shared cursor-line tracking for ViewPlugins.
 *
 * Instead of each plugin independently computing `doc.lineAt(selection.main.head).number`
 * and maintaining its own `lastCursorLine`, this StateField does it once. Plugins call
 * `getCursorLineChange(update)` to learn whether the cursor moved to a new line and,
 * if so, which lines were affected.
 *
 * `needsRebuildForLine` lets a plugin skip a full decoration rebuild when neither the
 * old nor the new cursor line contains content relevant to that plugin.
 */

import { EditorState, StateField } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';

// ── StateField ────────────────────────────────────────────

export const cursorLineField = StateField.define<number>({
  create(state) {
    return state.doc.lineAt(state.selection.main.head).number;
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection) {
      return tr.state.doc.lineAt(tr.state.selection.main.head).number;
    }
    return value;
  },
});

// ── Helpers ───────────────────────────────────────────────

/**
 * Returns the old and new cursor line numbers when the cursor moved to a
 * different line during this update. Returns `null` when the cursor stayed
 * on the same line or the selection didn't change.
 */
export function getCursorLineChange(
  update: ViewUpdate,
): { oldLine: number; newLine: number } | null {
  if (!update.selectionSet) return null;
  const oldLine = update.startState.field(cursorLineField);
  const newLine = update.state.field(cursorLineField);
  if (oldLine === newLine) return null;
  return { oldLine, newLine };
}

/**
 * Quick check: does the given line have content matching `pattern` OR
 * existing decorations from this plugin? If neither, the plugin can
 * safely skip a full rebuild for this line.
 */
export function needsRebuildForLine(
  state: EditorState,
  decos: DecorationSet,
  lineNum: number,
  pattern: RegExp,
): boolean {
  if (lineNum < 1 || lineNum > state.doc.lines) return false;
  const line = state.doc.line(lineNum);

  // Fast text check — does the line contain relevant markdown syntax?
  if (pattern.test(state.sliceDoc(line.from, line.to))) return true;

  // Does the plugin already have decorations on this line?
  let found = false;
  decos.between(line.from, line.to, () => {
    found = true;
    return false; // stop iterating
  });
  return found;
}
