import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { RangeSetBuilder, StateEffect } from '@codemirror/state';
import { ViewportBuffer, getDecorationRanges } from './viewport-buffer';
import { syntaxTree } from '@codemirror/language';
import { isCorrect, isDictionaryReady, initDictionary } from './spellcheck-engine';
import { useSettingsStore } from '../stores/settings-store';

const WORD_RE = /[a-zA-Z]+(?:'[a-zA-Z]+)*/g;

/** Syntax node types to skip (code, frontmatter, URLs) */
const SKIP_NODE_TYPES = new Set([
  'CodeBlock', 'FencedCode', 'InlineCode', 'CodeText', 'CodeMark', 'CodeInfo',
  'FrontMatter', 'Frontmatter',
  'URL', 'Link', 'LinkMark', 'LinkLabel',
  'HTMLTag', 'HTMLBlock', 'CommentBlock',
]);

/** Pre-compute all skip ranges in visible area for performance (avoids per-word tree iteration) */
function collectSkipRanges(view: EditorView): { from: number; to: number }[] {
  const tree = syntaxTree(view.state);
  const ranges: { from: number; to: number }[] = [];
  for (const { from, to } of getDecorationRanges(view)) {
    tree.iterate({
      from,
      to,
      enter(node) {
        if (SKIP_NODE_TYPES.has(node.name)) {
          ranges.push({ from: node.from, to: node.to });
          return false; // don't descend into children
        }
      },
    });
  }
  return ranges;
}

function isInSkipRange(pos: number, end: number, skipRanges: { from: number; to: number }[]): boolean {
  for (const range of skipRanges) {
    if (pos >= range.from && end <= range.to) return true;
    if (range.from > end) break; // ranges are sorted, no need to check further
  }
  return false;
}

const misspelledMark = Decoration.mark({ class: 'cm-misspelled' });

/** Effect to force a spellcheck rebuild (e.g. after dictionary changes) */
const recheckSpelling = StateEffect.define<null>();

/** Dispatch this on a view to force spellcheck decorations to rebuild */
export function triggerSpellcheckRebuild(view: EditorView): void {
  view.dispatch({ effects: recheckSpelling.of(null) });
}

const spellcheckPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    destroyed = false;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private vpBuffer = new ViewportBuffer();

    constructor(view: EditorView) {
      this.decorations = Decoration.none;
      // Kick off dictionary load, then rebuild decorations
      initDictionary().then(() => {
        if (this.destroyed) return;
        this.decorations = this.buildDecorations(view);
        this.vpBuffer.update(view);
        // Use requestMeasure to trigger a re-read of decorations without empty dispatch
        view.requestMeasure();
      });
    }

    update(update: ViewUpdate) {
      if (!isDictionaryReady()) return;

      // Check for recheck effect (triggered after dictionary changes)
      const hasRecheck = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(recheckSpelling))
      );
      if (hasRecheck) {
        this.decorations = this.buildDecorations(update.view);
        this.vpBuffer.update(update.view);
        return;
      }

      if (update.docChanged) {
        // Debounce on doc changes
        this.vpBuffer.reset();
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          if (this.destroyed) return;
          this.decorations = this.buildDecorations(update.view);
          this.vpBuffer.update(update.view);
          update.view.requestMeasure();
        }, 300);
        // Map existing decorations for immediate display
        this.decorations = this.decorations.map(update.changes);
      } else if (update.viewportChanged) {
        // Only rebuild if new content scrolled into view beyond the buffer
        if (this.vpBuffer.needsRebuild(update.view)) {
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            if (this.destroyed) return;
            this.decorations = this.buildDecorations(update.view);
            this.vpBuffer.update(update.view);
            update.view.requestMeasure();
          }, 150);
        }
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const skipCapitalized = useSettingsStore.getState().spellcheckSkipCapitalized;
      const skipRanges = collectSkipRanges(view);

      for (const { from, to } of getDecorationRanges(view)) {
        const text = view.state.sliceDoc(from, to);
        let match: RegExpExecArray | null;
        WORD_RE.lastIndex = 0;

        while ((match = WORD_RE.exec(text)) !== null) {
          const word = match[0];
          // Skip very short words and contractions-only
          if (word.length < 2) continue;
          // Skip words that are all apostrophes
          if (word.replace(/'/g, '').length === 0) continue;

          const wordFrom = from + match.index;
          const wordTo = wordFrom + word.length;

          // Skip capitalized words (proper nouns) if setting enabled
          if (skipCapitalized && word[0] >= 'A' && word[0] <= 'Z') continue;

          // Skip words inside code blocks, frontmatter, URLs (using pre-computed ranges)
          if (isInSkipRange(wordFrom, wordTo, skipRanges)) continue;

          if (!isCorrect(word)) {
            builder.add(wordFrom, wordTo, misspelledMark);
          }
        }
      }

      return builder.finish();
    }

    destroy() {
      this.destroyed = true;
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/** Theme for misspelled word underline */
export const spellcheckTheme = EditorView.baseTheme({
  '.cm-misspelled': {
    textDecoration: 'underline wavy',
    textDecorationColor: 'var(--ctp-red)',
    textUnderlineOffset: '2px',
  },
});

/**
 * Capture right-click position and misspelled word on mousedown, BEFORE live preview
 * reflows the line. EditorPane consumes this via consumeRightClickCapture().
 */
let pendingRightClick: {
  docPos: number;
  spellcheck: { word: string; from: number; to: number } | null;
} | null = null;

const spellcheckRightClickCapture = EditorView.domEventHandlers({
  mousedown(event: MouseEvent, view: EditorView) {
    if (event.button !== 2) return false;
    pendingRightClick = null;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    let spellclick: { word: string; from: number; to: number } | null = null;

    if (isDictionaryReady()) {
      const plugin = view.plugin(spellcheckPlugin);
      if (plugin) {
        plugin.decorations.between(0, view.state.doc.length, (from, to) => {
          if (pos >= from && pos <= to) {
            spellclick = {
              word: view.state.sliceDoc(from, to),
              from,
              to,
            };
            return false;
          }
        });
      }
    }

    pendingRightClick = { docPos: pos, spellcheck: spellclick };
    return false;
  },
});

/** Consume the pending right-click capture (docPos + spellcheck info) */
export function consumeRightClickCapture(): {
  docPos: number;
  spellcheck: { word: string; from: number; to: number } | null;
} | null {
  const result = pendingRightClick;
  pendingRightClick = null;
  return result;
}

/** All spellcheck extensions bundled together */
export const customSpellcheck = [spellcheckPlugin, spellcheckRightClickCapture, spellcheckTheme];
