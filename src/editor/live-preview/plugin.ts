import { DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { StateField } from '@codemirror/state';
import { foldEffect, unfoldEffect } from '@codemirror/language';
import { cursorLineField, getCursorLineChange, needsRebuildForLine } from '../cursor-line';
import { useVaultStore } from '../../stores/vault-store';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore } from '../../stores/settings-store';
import { buildDecorations, buildFrontmatterDecorations } from './build-decorations';

// ── Frontmatter StateField (block decorations require StateField, not ViewPlugin) ──

export const frontmatterField = StateField.define<DecorationSet>({
  create(state) {
    return buildFrontmatterDecorations(state);
  },
  update(decos, tr) {
    if (tr.docChanged) {
      return buildFrontmatterDecorations(tr.state);
    }
    if (tr.selection) {
      // Only rebuild when the cursor moves to a different line
      const oldLine = tr.startState.field(cursorLineField);
      const newLine = tr.state.field(cursorLineField);
      if (oldLine !== newLine) {
        return buildFrontmatterDecorations(tr.state);
      }
    }
    return decos;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

// ── Plugin ─────────────────────────────────────────────────

// Matches any markdown syntax that live-preview decorates
const LIVE_PREVIEW_PATTERN = /[#*_`[!>|~=\-\\]/;

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      // Check if fold state changed (fold/unfold effects)
      const foldChanged = update.transactions.some(tr => tr.effects.some(e => e.is(foldEffect) || e.is(unfoldEffect)));
      if (update.docChanged || update.viewportChanged || foldChanged) {
        this.decorations = buildDecorations(update.view);
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (change && (
          needsRebuildForLine(update.state, this.decorations, change.oldLine, LIVE_PREVIEW_PATTERN) ||
          needsRebuildForLine(update.state, this.decorations, change.newLine, LIVE_PREVIEW_PATTERN)
        )) {
          this.decorations = buildDecorations(update.view);
        }
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// ── Markdown link click handler ─────────────────────────────

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export const markdownLinkClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    // Require Ctrl/Cmd+Click to follow links; plain click places cursor for editing
    // In reading mode (not editable), allow plain click to follow links
    if (!event.ctrlKey && !event.metaKey && view.state.facet(EditorView.editable)) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const line = view.state.doc.lineAt(pos);
    LINK_RE.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = LINK_RE.exec(line.text)) !== null) {
      // Skip image links (preceded by !)
      if (match.index > 0 && line.text[match.index - 1] === '!') continue;

      const matchFrom = line.from + match.index;
      const matchTo = matchFrom + match[0].length;

      if (pos >= matchFrom && pos <= matchTo) {
        const url = match[2];
        event.preventDefault();

        // External URL — open in browser
        if (/^https?:\/\//.test(url)) {
          window.open(url, '_blank', 'noopener');
          return true;
        }

        // Local file link — navigate within vault
        const vaultPath = useVaultStore.getState().vaultPath;
        if (vaultPath) {
          const imageExts = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i;
          if (imageExts.test(url)) return true; // Don't navigate to image files
          const target = url.endsWith('.md') ? url : `${url}.md`;
          const settings = useSettingsStore.getState();
          useEditorStore.getState().openFile(vaultPath, target, settings.wikiLinksOpenInNewTab);
        }
        return true;
      }
    }

    return false;
  },
});
