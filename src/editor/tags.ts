import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { EditorState, type Range } from '@codemirror/state';
import { type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { TAG_PATTERN } from '../lib/tag-utils';
import { ViewportBuffer } from './viewport-buffer';
import { useSettingsStore } from '../stores/settings-store';
import { emit } from '../lib/cascade-events';

// ── Build decorations ──────────────────────────────────────

function buildDecorations(view: EditorView): DecorationSet {
  const deco: Range<Decoration>[] = [];
  const nestedSupport = useSettingsStore.getState().tagsNestedSupport;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    TAG_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = TAG_PATTERN.exec(text)) !== null) {
      const tagStart = from + match.index + (match[0].length - match[1].length - 1); // position of #
      let tagContent = match[1];
      // When nested support is off, truncate at first /
      if (!nestedSupport && tagContent.includes('/')) {
        tagContent = tagContent.split('/')[0];
      }
      const tagEnd = tagStart + tagContent.length + 1; // includes #
      deco.push(Decoration.mark({ class: 'cm-tag' }).range(tagStart, tagEnd));
    }
  }

  return Decoration.set(deco, true);
}

// ── Plugin ─────────────────────────────────────────────────

export const tags = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private vpBuffer = new ViewportBuffer();
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
      this.vpBuffer.update(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.vpBuffer.reset();
        this.decorations = buildDecorations(update.view);
        this.vpBuffer.update(update.view);
      } else if (update.viewportChanged) {
        if (this.vpBuffer.needsRebuild(update.view)) {
          this.decorations = buildDecorations(update.view);
          this.vpBuffer.update(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// ── Theme ──────────────────────────────────────────────────

export const tagTheme = EditorView.theme({
  '.cm-tag': {
    color: 'var(--ctp-teal)',
    backgroundColor: 'rgba(148, 226, 213, 0.12)',
    borderRadius: '3px',
    padding: '1px 4px',
    cursor: 'pointer',
    fontWeight: '500',
  },
});

// ── Tag completion ─────────────────────────────────────────

export function tagCompletion(context: CompletionContext): CompletionResult | null {
  if (!useSettingsStore.getState().tagsAutoComplete) return null;

  const word = context.matchBefore(/#[\w-/]*/);
  if (!word || word.from === word.to) return null;

  // Scan a bounded portion of the document to avoid perf issues on large files
  const maxScanLen = 100_000;
  const fullLen = context.state.doc.length;
  const doc = fullLen <= maxScanLen
    ? context.state.doc.toString()
    : context.state.doc.sliceString(0, maxScanLen);
  const tags = new Set<string>();
  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(doc)) !== null) {
    tags.add(match[1]);
  }

  const options = [...tags].sort().map((tag) => ({
    label: `#${tag}`,
    type: 'keyword' as const,
  }));

  return {
    from: word.from,
    options,
    validFor: /^#[\w-/]*$/,
  };
}

export const tagAutocompletion = EditorState.languageData.of(() => [{ autocomplete: tagCompletion }]);

// ── Click handler ──────────────────────────────────────────

export const tagClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    // Require Ctrl/Cmd+Click to follow tags; plain click places cursor for editing
    // In reading mode (not editable), allow plain click to follow tags
    if (!event.ctrlKey && !event.metaKey && view.state.facet(EditorView.editable)) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const line = view.state.doc.lineAt(pos);
    TAG_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = TAG_PATTERN.exec(line.text)) !== null) {
      const tagStart = line.from + match.index + (match[0].length - match[1].length - 1);
      const tagEnd = tagStart + match[1].length + 1;

      if (pos >= tagStart && pos <= tagEnd) {
        event.preventDefault();
        const tag = match[1].toLowerCase();
        // Dispatch a custom event that the sidebar can listen to
        emit('cascade:filter-tag', tag);
        return true;
      }
    }

    return false;
  },
});
