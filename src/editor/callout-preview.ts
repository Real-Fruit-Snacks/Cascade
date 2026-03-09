import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { getCursorLineChange, needsRebuildForLine } from './cursor-line';

// ── Callout types & icons ──────────────────────────────────

const CALLOUT_ICONS: Record<string, string> = {
  note: '✏️',
  abstract: '📋',
  summary: '📋',
  tldr: '📋',
  info: 'ℹ️',
  todo: '☑️',
  tip: '💡',
  hint: '💡',
  important: '💡',
  success: '✅',
  check: '✅',
  done: '✅',
  question: '❓',
  help: '❓',
  faq: '❓',
  warning: '⚠️',
  caution: '⚠️',
  attention: '⚠️',
  failure: '❌',
  fail: '❌',
  missing: '❌',
  danger: '🔴',
  error: '🔴',
  bug: '🐛',
  example: '📖',
  quote: '💬',
  cite: '💬',
};

const CALLOUT_COLORS: Record<string, string> = {
  note: 'var(--ctp-blue)',
  abstract: 'var(--ctp-teal)',
  summary: 'var(--ctp-teal)',
  tldr: 'var(--ctp-teal)',
  info: 'var(--ctp-blue)',
  todo: 'var(--ctp-blue)',
  tip: 'var(--ctp-teal)',
  hint: 'var(--ctp-teal)',
  important: 'var(--ctp-teal)',
  success: 'var(--ctp-green)',
  check: 'var(--ctp-green)',
  done: 'var(--ctp-green)',
  question: 'var(--ctp-yellow)',
  help: 'var(--ctp-yellow)',
  faq: 'var(--ctp-yellow)',
  warning: 'var(--ctp-peach)',
  caution: 'var(--ctp-peach)',
  attention: 'var(--ctp-peach)',
  failure: 'var(--ctp-red)',
  fail: 'var(--ctp-red)',
  missing: 'var(--ctp-red)',
  danger: 'var(--ctp-red)',
  error: 'var(--ctp-red)',
  bug: 'var(--ctp-red)',
  example: 'var(--ctp-mauve)',
  quote: 'var(--ctp-overlay1)',
  cite: 'var(--ctp-overlay1)',
};

// ── Callout header regex ───────────────────────────────────

// Matches: > [!type] optional title
const CALLOUT_HEAD_RE = /^>\s*\[!(\w+)\]([+-])?\s*(.*)?$/;

// ── Widget ─────────────────────────────────────────────────

class CalloutHeaderWidget extends WidgetType {
  constructor(
    readonly calloutType: string,
    readonly title: string,
    readonly foldable: boolean,
    readonly folded: boolean,
  ) {
    super();
  }

  eq(other: CalloutHeaderWidget) {
    return (
      this.calloutType === other.calloutType &&
      this.title === other.title &&
      this.foldable === other.foldable &&
      this.folded === other.folded
    );
  }

  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-callout-header';

    const key = this.calloutType.toLowerCase();
    const color = CALLOUT_COLORS[key] || 'var(--ctp-blue)';
    const icon = CALLOUT_ICONS[key] || '📝';
    wrap.style.setProperty('--callout-color', color);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'cm-callout-icon';
    iconSpan.textContent = icon;
    wrap.appendChild(iconSpan);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'cm-callout-title';
    titleSpan.textContent = this.title || this.calloutType.charAt(0).toUpperCase() + this.calloutType.slice(1);
    wrap.appendChild(titleSpan);

    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

// ── Build decorations ──────────────────────────────────────

function buildCalloutDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = view.state.doc;
  const cursor = view.state.selection.main;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      const match = line.text.match(CALLOUT_HEAD_RE);

      if (match) {
        const calloutType = match[1];
        const foldChar = match[2] || '';
        const title = (match[3] || '').trim();
        const foldable = foldChar === '+' || foldChar === '-';
        const folded = foldChar === '-';

        // Find the extent of the callout block (consecutive > lines)
        let blockEnd = line.to;
        let nextLineNum = line.number + 1;
        while (nextLineNum <= doc.lines) {
          const nextLine = doc.line(nextLineNum);
          if (nextLine.text.startsWith('>') || nextLine.text.match(/^>\s/)) {
            blockEnd = nextLine.to;
            nextLineNum++;
          } else {
            break;
          }
        }

        // Don't decorate if cursor is inside the callout block
        const blockStart = line.from;
        if (cursor.from >= blockStart && cursor.from <= blockEnd) {
          pos = blockEnd + 1;
          continue;
        }

        // Decorate the header line
        decorations.push(
          Decoration.replace({
            widget: new CalloutHeaderWidget(calloutType, title, foldable, folded),
          }).range(line.from, line.to),
        );

        // Decorate body lines — strip the leading `> ` and wrap in callout container
        let bodyLineNum = line.number + 1;
        while (bodyLineNum <= doc.lines) {
          const bodyLine = doc.line(bodyLineNum);
          if (!bodyLine.text.startsWith('>')) break;

          // Add line decoration for styling
          decorations.push(
            Decoration.line({
              class: 'cm-callout-body-line',
              attributes: { style: `--callout-color: ${CALLOUT_COLORS[calloutType.toLowerCase()] || 'var(--ctp-blue)'}` },
            }).range(bodyLine.from),
          );

          // Replace leading `> ` with nothing
          const prefixMatch = bodyLine.text.match(/^>\s?/);
          if (prefixMatch) {
            decorations.push(
              Decoration.replace({}).range(bodyLine.from, bodyLine.from + prefixMatch[0].length),
            );
          }

          bodyLineNum++;
        }

        pos = bodyLineNum <= doc.lines ? doc.line(bodyLineNum).from : doc.length + 1;
      } else {
        pos = line.to + 1;
      }
    }
  }

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

// ── Plugin ─────────────────────────────────────────────────

const CALLOUT_PATTERN = /^>/;

export const calloutPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildCalloutDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCalloutDecorations(update.view);
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (change && (
          needsRebuildForLine(update.state, this.decorations, change.oldLine, CALLOUT_PATTERN) ||
          needsRebuildForLine(update.state, this.decorations, change.newLine, CALLOUT_PATTERN)
        )) {
          this.decorations = buildCalloutDecorations(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ── Theme ──────────────────────────────────────────────────

export const calloutPreviewTheme = EditorView.theme({
  '.cm-callout-header': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px 6px 0 0',
    backgroundColor: 'color-mix(in srgb, var(--callout-color) 15%, transparent)',
    borderLeft: '3px solid var(--callout-color)',
    fontWeight: '600',
    fontSize: '0.95em',
  },
  '.cm-callout-icon': {
    fontSize: '1.1em',
  },
  '.cm-callout-title': {
    color: 'var(--callout-color)',
  },
  '.cm-callout-body-line': {
    paddingLeft: '12px',
    borderLeft: '3px solid var(--callout-color)',
    backgroundColor: 'color-mix(in srgb, var(--callout-color) 5%, transparent)',
  },
});
