/**
 * CodeMirror 6 extension for Tidemark variable highlighting.
 *
 * Color-codes variables based on resolution status:
 *   - Green: variable exists in frontmatter
 *   - Yellow/Orange: variable has a default value
 *   - Red: variable is missing
 */
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import type { Range } from '@codemirror/state';
import {
  extractFrontmatter,
  parseFrontmatter,
  findVariables,
  type TidemarkOptions,
} from '../lib/tidemark';
import { useSettingsStore } from '../stores/settings-store';

function getVariableOptions(): TidemarkOptions {
  const s = useSettingsStore.getState();
  return {
    openDelimiter: s.variablesOpenDelimiter,
    closeDelimiter: s.variablesCloseDelimiter,
    defaultSeparator: s.variablesDefaultSeparator,
    missingValueText: s.variablesMissingText,
    supportNesting: s.variablesSupportNesting,
    caseInsensitive: s.variablesCaseInsensitive,
    arrayJoinSeparator: s.variablesArrayJoinSeparator,
    preserveOnMissing: s.variablesPreserveOnMissing,
  };
}

const existsDeco = Decoration.mark({ class: 'cm-tidemark-exists' });
const hasDefaultDeco = Decoration.mark({ class: 'cm-tidemark-default' });
const missingDeco = Decoration.mark({ class: 'cm-tidemark-missing' });

function buildDecorations(view: EditorView): DecorationSet {
  // Only read enough to find frontmatter (always at start of doc) — avoids O(doc_size) toString()
  const fmSearchLimit = Math.min(view.state.doc.length, 10000);
  const fmText = view.state.sliceDoc(0, fmSearchLimit);
  const fm = extractFrontmatter(fmText);
  const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
  const bodyStart = fm ? fm.bodyStart : 0;
  const opts = getVariableOptions();
  const deco: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    // Only decorate body (after frontmatter if present)
    const effectiveFrom = Math.max(from, bodyStart);
    if (effectiveFrom >= to) continue;

    const text = view.state.sliceDoc(effectiveFrom, to);
    const vars = findVariables(text, effectiveFrom, frontmatter, opts);

    for (const v of vars) {
      const d = v.status === 'exists' ? existsDeco
        : v.status === 'has-default' ? hasDefaultDeco
        : missingDeco;
      deco.push(d.range(v.from, v.to));
    }
  }

  return Decoration.set(deco, true);
}

export const tidemarkHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const tidemarkTheme = EditorView.theme({
  '.cm-tidemark-exists': {
    color: 'var(--ctp-green) !important',
    backgroundColor: 'rgba(166, 227, 161, 0.12)',
    borderRadius: '3px',
    padding: '1px 3px',
    fontWeight: '500',
  },
  '.cm-tidemark-default': {
    color: 'var(--ctp-peach) !important',
    backgroundColor: 'rgba(250, 179, 135, 0.12)',
    borderRadius: '3px',
    padding: '1px 3px',
    fontWeight: '500',
  },
  '.cm-tidemark-missing': {
    color: 'var(--ctp-red) !important',
    backgroundColor: 'rgba(243, 139, 168, 0.12)',
    borderRadius: '3px',
    padding: '1px 3px',
    fontWeight: '500',
  },
});
