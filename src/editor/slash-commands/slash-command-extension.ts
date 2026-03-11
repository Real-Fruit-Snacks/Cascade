import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { slashCommandBus } from '../../lib/slash-command-bus';

/** Track slash-command state within the editor */
let activeSlashFrom: number | null = null;

function isWordBoundary(view: EditorView, pos: number): boolean {
  if (pos === 0) return true;
  const line = view.state.doc.lineAt(pos);
  if (pos === line.from) return true;
  const charBefore = view.state.sliceDoc(pos - 1, pos);
  return /\s/.test(charBefore);
}

const slashInputHandler = EditorView.inputHandler.of((view, from, _to, text) => {
  if (text !== '/') return false;
  if (!isWordBoundary(view, from)) return false;

  // Schedule after the character is inserted
  requestAnimationFrame(() => {
    const pos = from + 1; // after the `/`
    const coords = view.coordsAtPos(pos);
    if (!coords) return;

    const editorRect = view.dom.getBoundingClientRect();
    activeSlashFrom = from;

    slashCommandBus.open({
      x: coords.left - editorRect.left,
      y: coords.bottom - editorRect.top,
      from,
      query: '',
    });
  });

  return false; // let CM insert the `/`
});

/** Watch for doc changes while menu is open to update filter query or dismiss */
const slashUpdatePlugin = ViewPlugin.fromClass(class {
  update(update: ViewUpdate) {
    if (activeSlashFrom === null) return;

    const head = update.state.selection.main.head;

    // Check if slash position is still valid
    if (activeSlashFrom >= update.state.doc.length) {
      activeSlashFrom = null;
      slashCommandBus.close();
      return;
    }

    const line = update.state.doc.lineAt(head);
    const slashLine = update.state.doc.lineAt(activeSlashFrom);

    // Dismiss if cursor moved to a different line or before the slash
    if (line.number !== slashLine.number || head < activeSlashFrom) {
      activeSlashFrom = null;
      slashCommandBus.close();
      return;
    }

    // Extract query: text between `/` and cursor
    const query = update.state.sliceDoc(activeSlashFrom + 1, head);

    // Dismiss if query contains whitespace (user typed a space — probably not a command)
    if (/\s/.test(query)) {
      activeSlashFrom = null;
      slashCommandBus.close();
      return;
    }

    slashCommandBus.updateQuery(query, activeSlashFrom);
  }
});

export function dismissSlashMenu() {
  activeSlashFrom = null;
  slashCommandBus.close();
}

export function getActiveSlashFrom(): number | null {
  return activeSlashFrom;
}

export function clearActiveSlash() {
  activeSlashFrom = null;
}

export const slashCommandExtension: Extension = [
  slashInputHandler,
  slashUpdatePlugin,
];
