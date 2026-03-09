import { EditorView, keymap } from '@codemirror/view';

function wrapSelection(view: EditorView, marker: string): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  // If already wrapped, unwrap
  if (
    from >= marker.length &&
    view.state.sliceDoc(from - marker.length, from) === marker &&
    view.state.sliceDoc(to, to + marker.length) === marker
  ) {
    view.dispatch({
      changes: [
        { from: from - marker.length, to: from, insert: '' },
        { from: to, to: to + marker.length, insert: '' },
      ],
      selection: { anchor: from - marker.length, head: to - marker.length },
    });
    return true;
  }

  // Wrap selection (or insert markers at cursor)
  const insert = `${marker}${selected}${marker}`;
  view.dispatch({
    changes: { from, to, insert },
    selection: selected
      ? { anchor: from + marker.length, head: to + marker.length }
      : { anchor: from + marker.length },
  });
  return true;
}

function insertLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected) {
    // If selection looks like a URL, make it the href
    if (/^https?:\/\//.test(selected)) {
      const insert = `[](${selected})`;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 1 }, // cursor inside []
      });
    } else {
      const insert = `[${selected}](url)`;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 }, // select "url"
      });
    }
  } else {
    const insert = '[](url)';
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + 1 }, // cursor inside []
    });
  }
  return true;
}

export const formattingKeymap = keymap.of([
  { key: 'Mod-b', run: (view) => wrapSelection(view, '**') },
  { key: 'Mod-i', run: (view) => wrapSelection(view, '*') },
  { key: 'Mod-k', run: (view) => insertLink(view) },
]);
