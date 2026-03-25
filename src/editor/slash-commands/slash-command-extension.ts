import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { slashCommandBus } from '../../lib/slash-command-bus';

/** Per-view slash-command state (avoids shared mutable module-level variable) */
const viewSlashFrom = new WeakMap<EditorView, number | null>();

function getSlashFrom(view: EditorView): number | null {
  return viewSlashFrom.get(view) ?? null;
}

function setSlashFrom(view: EditorView, value: number | null): void {
  viewSlashFrom.set(view, value);
}

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
    setSlashFrom(view, from);

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
    const activeSlashFrom = getSlashFrom(update.view);
    if (activeSlashFrom === null) return;

    const head = update.state.selection.main.head;

    // Check if slash position is still valid
    if (activeSlashFrom >= update.state.doc.length) {
      setSlashFrom(update.view, null);
      slashCommandBus.close();
      return;
    }

    const line = update.state.doc.lineAt(head);
    const slashLine = update.state.doc.lineAt(activeSlashFrom);

    // Dismiss if cursor moved to a different line or before the slash
    if (line.number !== slashLine.number || head < activeSlashFrom) {
      setSlashFrom(update.view, null);
      slashCommandBus.close();
      return;
    }

    // Extract query: text between `/` and cursor
    const query = update.state.sliceDoc(activeSlashFrom + 1, head);

    // Dismiss if query contains whitespace (user typed a space — probably not a command)
    if (/\s/.test(query)) {
      setSlashFrom(update.view, null);
      slashCommandBus.close();
      return;
    }

    slashCommandBus.updateQuery(query, activeSlashFrom);
  }
});

export function dismissSlashMenu(view?: EditorView) {
  if (view) {
    setSlashFrom(view, null);
  }
  slashCommandBus.close();
}

export function getActiveSlashFrom(view: EditorView): number | null {
  return getSlashFrom(view);
}

export function clearActiveSlash(view?: EditorView) {
  if (view) setSlashFrom(view, null);
}

export const slashCommandExtension: Extension = [
  slashInputHandler,
  slashUpdatePlugin,
];
