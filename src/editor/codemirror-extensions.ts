/**
 * codemirror-extensions.ts
 *
 * Compartment definitions and extension-builder helpers that are specific to
 * the main editor (use-codemirror.ts).  Pure-rendering extensions shared with
 * canvas cards live in build-extensions.ts instead.
 *
 * Exports:
 *   - Compartments interface + createCompartments()
 *   - buildCodeFoldingExtensions()
 */

import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { defaultKeymap, historyKeymap, history, redo, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { openSearchPanel, search, searchKeymap, highlightSelectionMatches, selectNextOccurrence } from '@codemirror/search';
import { foldGutter, foldKeymap, foldService } from '@codemirror/language';
import { createSearchPanel } from './search-in-selection';
import { searchTheme } from './search-theme';
import { customSpellcheck } from './custom-spellcheck';
import { dropHandler } from './drop-handler';
import { typewriterMode, typewriterPadding, focusMode } from './typewriter-mode';
import { slashCommandExtension } from './slash-commands/slash-command-extension';
import { formattingKeymap } from './formatting-commands';
import { smartListKeymap } from './smart-lists';
import { type RenderCompartments, createRenderCompartments } from './build-extensions';

// ---------------------------------------------------------------------------
// Compartments
// ---------------------------------------------------------------------------

export interface Compartments extends RenderCompartments {
  lineNumbersComp: Compartment;
  vimComp: Compartment;
  highlightActiveLineComp: Compartment;
  readableLineLengthComp: Compartment;
  spellcheckComp: Compartment;
  codeFoldingComp: Compartment;
  typewriterComp: Compartment;
  focusModeComp: Compartment;
  slashCommandsComp: Compartment;
  collabComp: Compartment;
}

export function createCompartments(): Compartments {
  return {
    ...createRenderCompartments(),
    lineNumbersComp: new Compartment(),
    vimComp: new Compartment(),
    highlightActiveLineComp: new Compartment(),
    readableLineLengthComp: new Compartment(),
    spellcheckComp: new Compartment(),
    codeFoldingComp: new Compartment(),
    typewriterComp: new Compartment(),
    focusModeComp: new Compartment(),
    slashCommandsComp: new Compartment(),
    collabComp: new Compartment(),
  };
}

// ---------------------------------------------------------------------------
// Code-folding helpers
// ---------------------------------------------------------------------------

// Cache keyed on doc identity to avoid repeated linear scans (WeakMap — safe across split panes)
const codeBlockFoldCache = new WeakMap<import('@codemirror/state').Text, Map<number, { from: number; to: number }>>();

function getCodeBlockFolds(state: EditorState): Map<number, { from: number; to: number }> {
  const cached = codeBlockFoldCache.get(state.doc);
  if (cached) return cached;
  const folds = new Map<number, { from: number; to: number }>();
  let openLine: { from: number; to: number; number: number } | null = null;
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (line.text.startsWith('```')) {
      if (openLine) {
        folds.set(openLine.from, { from: openLine.to, to: line.to });
        openLine = null;
      } else {
        openLine = { from: line.from, to: line.to, number: i };
      }
    }
  }
  codeBlockFoldCache.set(state.doc, folds);
  return folds;
}

const markdownCodeBlockFold = foldService.of((state, from) => {
  return getCodeBlockFolds(state).get(from) ?? null;
});

const foldGutterTheme = EditorView.theme({
  '.cm-foldGutter .cm-gutterElement': {
    color: 'var(--ctp-overlay0)',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: '0.85em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    color: 'var(--ctp-accent)',
  },
  '.cm-foldPlaceholder': {
    color: 'var(--ctp-overlay0)',
    background: 'none',
    border: 'none',
    padding: '0 2px',
    margin: '0 1px',
    cursor: 'pointer',
    fontSize: 'inherit',
    opacity: '0.4',
  },
  '.cm-foldPlaceholder:hover': {
    opacity: '0.8',
    color: 'var(--ctp-accent)',
  },
});

// Cache heading fold ranges — single O(N) pass instead of O(N) per heading
// WeakMap<doc, Map<foldMinLevel, folds>> — safe across split panes and different foldMinLevel values
const headingFoldCache = new WeakMap<import('@codemirror/state').Text, Map<number, Map<number, { from: number; to: number }>>>();

function getHeadingFolds(state: EditorState, foldMinLevel: number): Map<number, { from: number; to: number }> {
  const byLevel = headingFoldCache.get(state.doc);
  if (byLevel) {
    const cached = byLevel.get(foldMinLevel);
    if (cached) return cached;
  }
  const folds = new Map<number, { from: number; to: number }>();
  const headings: { from: number; to: number; level: number }[] = [];

  // Single pass: collect all headings
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const match = line.text.match(/^(#{1,6})\s/);
    if (match) {
      headings.push({ from: line.from, to: line.to, level: match[1].length });
    }
  }

  // For each heading, find fold end via next same-or-higher-level heading
  for (let idx = 0; idx < headings.length; idx++) {
    const h = headings[idx];
    if (h.level < foldMinLevel) continue;
    let end = state.doc.length;
    for (let j = idx + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) {
        end = headings[j].from > 0 ? headings[j].from - 1 : headings[j].from;
        break;
      }
    }
    if (end > h.to) {
      folds.set(h.from, { from: h.to, to: end });
    }
  }

  if (byLevel) {
    byLevel.set(foldMinLevel, folds);
  } else {
    headingFoldCache.set(state.doc, new Map([[foldMinLevel, folds]]));
  }
  return folds;
}

export function buildCodeFoldingExtensions(
  enabled: boolean,
  foldHeadings: boolean,
  foldCodeBlocks: boolean,
  foldMinLevel: number,
) {
  if (!enabled) return [];
  const services = [];
  if (foldHeadings) {
    services.push(
      foldService.of((state, from) => {
        return getHeadingFolds(state, foldMinLevel).get(from) ?? null;
      }),
    );
  }
  if (foldCodeBlocks) {
    services.push(markdownCodeBlockFold);
  }
  return [...services, foldGutter({ openText: '▾', closedText: '▸' }), foldGutterTheme];
}

// ---------------------------------------------------------------------------
// Editor-specific settings needed for initial extension setup
// ---------------------------------------------------------------------------

export interface EditorInitSettings {
  showLineNumbers: boolean;
  highlightActiveLine: boolean;
  readableLineLength: number;
  spellcheck: boolean;
  enableCodeFolding: boolean;
  foldHeadings: boolean;
  foldCodeBlocks: boolean;
  foldMinLevel: number;
  enableTypewriterMode: boolean;
  typewriterOffset: number;
  enableFocusMode: boolean;
  focusModeDimParagraphs: boolean;
  enableSlashCommands: boolean;
}

/**
 * Builds the editor-specific (non-rendering) extension array for EditorState.create().
 * The caller must prepend the shared renderExts from buildRenderExtensions().
 *
 * @param comps        - compartment refs from createCompartments()
 * @param settings     - initial settings snapshot
 * @param saveKeymap   - pre-built save keymap extension
 * @param extraExts    - additional dynamic extensions (mousedown handler, update listener)
 */
export function buildEditorExtensions(
  comps: Compartments,
  settings: EditorInitSettings,
  saveKeymap: Extension,
  extraExts: Extension[],
): Extension[] {
  return [
    comps.vimComp.of([]),
    comps.lineNumbersComp.of(settings.showLineNumbers ? lineNumbers() : []),
    comps.highlightActiveLineComp.of(settings.highlightActiveLine ? highlightActiveLine() : []),
    comps.readableLineLengthComp.of(
      settings.readableLineLength > 0
        ? EditorView.theme({ '.cm-content': { maxWidth: `${settings.readableLineLength}px`, marginLeft: 'auto', marginRight: 'auto' } })
        : [],
    ),
    comps.spellcheckComp.of(settings.spellcheck ? customSpellcheck : []),
    comps.codeFoldingComp.of(buildCodeFoldingExtensions(settings.enableCodeFolding, settings.foldHeadings, settings.foldCodeBlocks, settings.foldMinLevel)),
    comps.typewriterComp.of(settings.enableTypewriterMode ? [typewriterMode(settings.typewriterOffset), typewriterPadding] : []),
    comps.focusModeComp.of(settings.enableFocusMode && settings.focusModeDimParagraphs ? focusMode : []),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    search({ top: true, createPanel: createSearchPanel }),
    searchTheme,
    highlightSelectionMatches(),
    history(),
    keymap.of([
      { key: 'Mod-h', run: (view) => { openSearchPanel(view); return true; } },
      { key: 'Mod-y', run: redo },
      { key: 'Mod-d', run: selectNextOccurrence, preventDefault: true },
      ...closeBracketsKeymap, ...foldKeymap, ...searchKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap,
    ]),
    saveKeymap,
    smartListKeymap,
    formattingKeymap,
    dropHandler,
    comps.slashCommandsComp.of(settings.enableSlashCommands ? slashCommandExtension : []),
    comps.collabComp.of([]),
    ...extraExts,
  ];
}
