import { EditorView, keymap } from '@codemirror/view';

// Matches list markers: - , * , + , 1. , 2. , etc. with optional checkbox
const LIST_RE = /^(\s*)([-*+]|\d+\.)\s(\[[ xX]\]\s)?/;

function smartEnter(view: EditorView): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;

  // Only handle single cursor (no selection range)
  if (from !== to) return false;

  const line = state.doc.lineAt(from);
  const match = line.text.match(LIST_RE);
  if (!match) return false;

  const indent = match[1];
  const marker = match[2];
  const checkbox = match[3] || '';
  const contentStart = match[0].length;
  const contentAfterMarker = line.text.slice(contentStart).trim();

  // If the line is an empty list item (just the marker), remove it and exit the list
  if (!contentAfterMarker) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
    });
    return true;
  }

  // Build the next list marker
  let nextMarker = marker;
  const numMatch = marker.match(/^(\d+)\.$/);
  if (numMatch) {
    nextMarker = (parseInt(numMatch[1], 10) + 1) + '.';
  }

  // If there's a checkbox, always start unchecked
  const nextCheckbox = checkbox ? '[ ] ' : '';

  const insert = '\n' + indent + nextMarker + ' ' + nextCheckbox;

  view.dispatch({
    changes: { from, to: from, insert },
    selection: { anchor: from + insert.length },
  });

  return true;
}

export const smartListKeymap = keymap.of([
  { key: 'Enter', run: smartEnter },
]);
