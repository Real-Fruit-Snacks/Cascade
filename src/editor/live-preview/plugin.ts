import { DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { foldEffect, unfoldEffect } from '@codemirror/language';
import { cursorLineField, getCursorLineChange, needsRebuildForLine } from '../cursor-line';
import { useVaultStore } from '../../stores/vault-store';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore } from '../../stores/settings-store';
import { buildDecorations, buildFrontmatterDecorations } from './build-decorations';

/** Effect dispatched after a pointer click to trigger a deferred decoration rebuild. */
const deferredRebuildEffect = StateEffect.define<null>();

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
    private pendingRebuild: ReturnType<typeof setTimeout> | null = null;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      // Check if fold state changed (fold/unfold effects)
      const foldChanged = update.transactions.some(tr => tr.effects.some(e => e.is(foldEffect) || e.is(unfoldEffect)));

      // Deferred rebuild triggered by our own effect (after a pointer click)
      if (update.transactions.some(tr => tr.effects.some(e => e.is(deferredRebuildEffect)))) {
        this.decorations = buildDecorations(update.view);
        return;
      }

      if (update.docChanged || update.viewportChanged || foldChanged) {
        // Immediate rebuild on content/viewport/fold changes
        if (this.pendingRebuild) { clearTimeout(this.pendingRebuild); this.pendingRebuild = null; }
        this.decorations = buildDecorations(update.view);
      } else if (update.selectionSet) {
        const change = getCursorLineChange(update);
        if (change && (
          needsRebuildForLine(update.state, this.decorations, change.oldLine, LIVE_PREVIEW_PATTERN) ||
          needsRebuildForLine(update.state, this.decorations, change.newLine, LIVE_PREVIEW_PATTERN)
        )) {
          // Check if this selection was from a mouse click
          const isPointer = update.transactions.some(tr => tr.isUserEvent('select.pointer'));
          if (isPointer) {
            // Defer rebuild — let the cursor land at the correct visual position first,
            // then reveal syntax on the next frame. This prevents the "click offset" feel
            // caused by replace decorations shifting text immediately on click.
            if (this.pendingRebuild) clearTimeout(this.pendingRebuild);
            const view = update.view;
            this.pendingRebuild = setTimeout(() => {
              this.pendingRebuild = null;
              view.dispatch({ effects: deferredRebuildEffect.of(null) });
            }, 0);
          } else {
            // Keyboard navigation — rebuild immediately
            this.decorations = buildDecorations(update.view);
          }
        }
      }
    }
    destroy() {
      if (this.pendingRebuild) { clearTimeout(this.pendingRebuild); this.pendingRebuild = null; }
    }
  },
  { decorations: (v) => v.decorations }
);

// ── Markdown link click handler ─────────────────────────────

export const markdownLinkClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    // Require Ctrl/Cmd+Click to follow links; plain click places cursor for editing
    // In reading mode (not editable), allow plain click to follow links
    if (!event.ctrlKey && !event.metaKey && view.state.facet(EditorView.editable)) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const line = view.state.doc.lineAt(pos);
    // Fresh regex each call — avoids shared mutable lastIndex across re-entrant calls
    const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

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
