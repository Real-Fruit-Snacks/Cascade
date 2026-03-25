import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { getCursorLineChange, needsRebuildForLine } from './cursor-line';
import { ViewportBuffer, getDecorationRanges } from './viewport-buffer';
import { useToastStore } from '../stores/toast-store';
import { useSettingsStore } from '../stores/settings-store';
import { resolveWikiLink, parseWikiTarget } from '../lib/wiki-link-resolver';

// ── Regex ──────────────────────────────────────────────────
// Matches [[target]] and [[target|display]]
const WIKI_LINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

// ── Helpers ────────────────────────────────────────────────

function cursorOnLines(state: EditorState, from: number, to: number): boolean {
  // In reading mode (not editable), never reveal source — always show formatted preview
  if (!state.facet(EditorView.editable)) return false;
  const head = state.selection.main.head;
  const cursorLine = state.doc.lineAt(head).number;
  const lineFrom = state.doc.lineAt(from).number;
  const lineTo = state.doc.lineAt(to).number;
  return cursorLine >= lineFrom && cursorLine <= lineTo;
}

// ── Build decorations ──────────────────────────────────────

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const deco: Range<Decoration>[] = [];
  const flatFiles = useVaultStore.getState().flatFiles;

  for (const { from, to } of getDecorationRanges(view)) {
    const text = state.sliceDoc(from, to);
    WIKI_LINK_RE.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = WIKI_LINK_RE.exec(text)) !== null) {
      const matchFrom = from + match.index;
      const matchTo = matchFrom + match[0].length;
      const target = match[1];
      const active = cursorOnLines(state, matchFrom, matchTo);
      const resolved = resolveWikiLink(target, flatFiles);
      const cssClass = resolved ? 'cm-wiki-link' : 'cm-wiki-link cm-wiki-link-broken';
      const showFullPath = useSettingsStore.getState().wikiLinksShowFullPath;

      // Always style the whole match
      const markAttrs: { class: string; attributes?: Record<string, string> } = { class: cssClass };
      if (!active && showFullPath && resolved) {
        const resolvedPath = resolved.endsWith('.md') ? resolved.slice(0, -3) : resolved;
        markAttrs.attributes = { title: resolvedPath };
      }
      deco.push(Decoration.mark(markAttrs).range(matchFrom, matchTo));

      if (!active) {
        // Hide [[ at start
        deco.push(Decoration.replace({}).range(matchFrom, matchFrom + 2));
        // Hide ]] at end
        deco.push(Decoration.replace({}).range(matchTo - 2, matchTo));
        // If there's a pipe alias, hide target| and show only display
        if (match[2]) {
          const pipeOffset = matchFrom + 2 + target.length;
          // Hide from after [[ to after | (covers "target|")
          deco.push(Decoration.replace({}).range(matchFrom + 2, pipeOffset + 1));
        }
      }
    }
  }

  return Decoration.set(deco, true);
}

// ── Plugin ─────────────────────────────────────────────────

const WIKI_LINK_PATTERN = /\[\[/;

export const wikiLinks = ViewPlugin.fromClass(
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
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (change && (
          needsRebuildForLine(update.state, this.decorations, change.oldLine, WIKI_LINK_PATTERN) ||
          needsRebuildForLine(update.state, this.decorations, change.newLine, WIKI_LINK_PATTERN)
        )) {
          this.decorations = buildDecorations(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// ── Click handler ──────────────────────────────────────────

export const wikiLinkClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    // Require Ctrl/Cmd+Click to follow links; plain click places cursor for editing
    // In reading mode (not editable), allow plain click to follow links
    if (!event.ctrlKey && !event.metaKey && view.state.facet(EditorView.editable)) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    // Only scan the clicked line instead of the entire document
    const line = view.state.doc.lineAt(pos);
    WIKI_LINK_RE.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = WIKI_LINK_RE.exec(line.text)) !== null) {
      const matchFrom = line.from + match.index;
      const matchTo = matchFrom + match[0].length;

      if (pos >= matchFrom && pos <= matchTo) {
        const target = match[1];
        const { file: fileTarget, heading, blockId } = parseWikiTarget(target);
        const flatFiles = useVaultStore.getState().flatFiles;
        const resolved = resolveWikiLink(target, flatFiles);

        event.preventDefault();
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return true;

        const settings = useSettingsStore.getState();
        if (resolved) {
          if (heading) {
            useEditorStore.setState({ pendingScrollHeading: heading });
          } else if (blockId) {
            useEditorStore.setState({ pendingScrollBlockId: blockId });
          }
          useEditorStore.getState().openFile(vaultPath, resolved, settings.wikiLinksOpenInNewTab);
        } else if (settings.wikiLinksCreateOnFollow) {
          const fileName = fileTarget.endsWith('.md') ? fileTarget : `${fileTarget}.md`;
          if (fileName.includes('..') || fileName.startsWith('/') || fileName.startsWith('\\') || /[<>:"|?*]/.test(fileName)) {
            useToastStore.getState().addToast('Invalid file name', 'error');
            return true;
          }
          useVaultStore.getState().createFile(fileName).then(() => {
            useEditorStore.getState().openFile(vaultPath, fileName, settings.wikiLinksOpenInNewTab);
          }).catch(() => {
            useToastStore.getState().addToast(`Failed to create file: ${fileName}`, 'error');
          });
        } else {
          useToastStore.getState().addToast(`Note "${target}" not found`, 'warning');
        }
        return true;
      }
    }

    return false;
  },
});

// ── Theme ──────────────────────────────────────────────────

export const wikiLinkTheme = EditorView.theme({
  '.cm-wiki-link': {
    color: 'var(--ctp-blue)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },
  '.cm-wiki-link-broken': {
    color: 'var(--ctp-red)',
    textDecoration: 'underline dashed',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },
});


