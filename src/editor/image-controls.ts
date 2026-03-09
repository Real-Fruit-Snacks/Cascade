import { StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
} from '@codemirror/view';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useVaultStore } from '../stores/vault-store';

// ── Types ───────────────────────────────────────────────────

export type ImageAlign = 'left' | 'center' | 'right';

export interface ImageSelection {
  from: number;
  to: number;
  src: string;
  rawUrl: string;
  alt: string;
  pipeWidth: number | null;
  align: ImageAlign | null;
}

// ── State Effects ───────────────────────────────────────────

export const selectImage = StateEffect.define<ImageSelection>();
export const deselectImage = StateEffect.define<null>();

// ── Helpers ─────────────────────────────────────────────────

const ALIGNS = new Set<string>(['left', 'center', 'right']);

/**
 * Parse "alt|300|center" -> { alt: "alt", width: 300, align: "center" }
 * Supports: "alt", "alt|300", "alt|center", "alt|300|center"
 */
export function parseAltWidth(altText: string): { alt: string; width: number | null; align: ImageAlign | null } {
  const parts = altText.split('|');
  const alt = parts[0];
  let width: number | null = null;
  let align: ImageAlign | null = null;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (ALIGNS.has(part)) {
      align = part as ImageAlign;
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) width = num;
    }
  }

  return { alt, width, align };
}

/**
 * Build "alt|300|center" from parts. Omits null values.
 */
export function buildAltWidth(alt: string, width: number | null, align: ImageAlign | null = null): string {
  let result = alt;
  if (width !== null) result += `|${width}`;
  if (align !== null) result += `|${align}`;
  return result;
}

// ── ImageSelection StateField ────────────────────────────────

export const imageSelectionField = StateField.define<ImageSelection | null>({
  create() {
    return null;
  },
  update(sel, tr) {
    for (const effect of tr.effects) {
      if (effect.is(selectImage)) return effect.value;
      if (effect.is(deselectImage)) return null;
    }
    // Only reset on external doc changes (no selectImage effect)
    if (tr.docChanged) return null;
    return sel;
  },
});

// ── Escape key handler ───────────────────────────────────────

const imageDeselectOnEscape = keymap.of([
  {
    key: 'Escape',
    run(view) {
      const sel = view.state.field(imageSelectionField);
      if (sel !== null) {
        view.dispatch({ effects: deselectImage.of(null) });
        return true;
      }
      return false;
    },
  },
]);

// ── Mousedown deselect (clicking outside .cm-image-widget) ──
// Use a ViewPlugin so we have access to the view instance in the handler.

const imageDeselectOnOutsideClick = ViewPlugin.fromClass(
  class {
    private handler: (e: MouseEvent) => void;
    private dom: HTMLElement;

    constructor(view: EditorView) {
      this.dom = view.dom;
      this.handler = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (!target) return;
        if (
          target.closest('.cm-image-widget') ||
          target.closest('.cm-image-toolbar')
        ) {
          return;
        }
        const sel = view.state.field(imageSelectionField, false);
        if (sel !== null) {
          view.dispatch({ effects: deselectImage.of(null) });
        }
      };
      this.dom.addEventListener('mousedown', this.handler);
    }

    destroy() {
      this.dom.removeEventListener('mousedown', this.handler);
    }
  }
);

// ── ImageToolbarWidget ───────────────────────────────────────

class ImageToolbarWidget extends WidgetType {
  constructor(readonly sel: ImageSelection) {
    super();
  }

  eq(other: ImageToolbarWidget) {
    return (
      this.sel.from === other.sel.from &&
      this.sel.to === other.sel.to &&
      this.sel.src === other.sel.src &&
      this.sel.alt === other.sel.alt &&
      this.sel.pipeWidth === other.sel.pipeWidth &&
      this.sel.align === other.sel.align
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'cm-image-toolbar';

    // ── Resize group ──
    const resizeGroup = document.createElement('div');
    resizeGroup.className = 'cm-image-toolbar-group';

    const presets: Array<{ label: string; pct: number | null }> = [
      { label: 'S', pct: 0.25 },
      { label: 'M', pct: 0.5 },
      { label: 'L', pct: 0.75 },
      { label: 'Full', pct: null },
    ];

    const editorWidth = view.contentDOM.clientWidth;

    for (const preset of presets) {
      const btn = document.createElement('button');
      btn.className = 'cm-image-toolbar-btn';
      btn.textContent = preset.label;

      // Highlight active preset
      let isActive = false;
      if (preset.pct === null) {
        isActive = this.sel.pipeWidth === null;
      } else {
        const px = Math.round(editorWidth * preset.pct);
        isActive = this.sel.pipeWidth === px;
      }
      if (isActive) btn.classList.add('cm-image-toolbar-active');

      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.applyResize(view, preset.pct);
      });

      resizeGroup.appendChild(btn);
    }

    toolbar.appendChild(resizeGroup);
    toolbar.appendChild(this.makeDivider());

    // ── Alignment group ──
    const alignGroup = document.createElement('div');
    alignGroup.className = 'cm-image-toolbar-group';

    const alignments: Array<{ label: string; svg: string; value: ImageAlign | null }> = [
      { label: 'Align left', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>', value: 'left' },
      { label: 'Align center', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>', value: 'center' },
      { label: 'Align right', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>', value: 'right' },
    ];

    for (const alignment of alignments) {
      const btn = document.createElement('button');
      btn.className = 'cm-image-toolbar-btn';
      btn.innerHTML = alignment.svg;
      btn.title = alignment.label;
      if (this.sel.align === alignment.value) btn.classList.add('cm-image-toolbar-active');

      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        // Toggle: if already active, remove alignment
        const newAlign = this.sel.align === alignment.value ? null : alignment.value;
        this.applyAlign(view, newAlign);
      });

      alignGroup.appendChild(btn);
    }

    toolbar.appendChild(alignGroup);
    toolbar.appendChild(this.makeDivider());

    // ── Alt text group ──
    const altGroup = document.createElement('div');
    altGroup.className = 'cm-image-toolbar-group';

    const altBtn = document.createElement('button');
    altBtn.className = 'cm-image-toolbar-btn';
    altBtn.textContent = 'Alt';
    altBtn.title = 'Edit alt text';

    let altInput: HTMLInputElement | null = null;

    altBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (altInput) return; // already open

      altInput = document.createElement('input');
      altInput.type = 'text';
      altInput.className = 'cm-image-toolbar-alt-input';
      altInput.value = this.sel.alt;
      altInput.placeholder = 'Alt text';

      const commit = () => {
        if (!altInput) return;
        const raw = altInput.value;
        // Sanitize: strip [, ], |
        const sanitized = raw.replace(/[[\]|]/g, '');
        const el = altInput;
        altInput = null; // Null before remove to prevent re-entry from blur
        el.remove();
        this.applyAlt(view, sanitized);
      };

      const cancel = () => {
        if (!altInput) return;
        altInput.remove();
        altInput = null;
      };

      altInput.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          commit();
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          cancel();
        }
        ke.stopPropagation();
      });

      altInput.addEventListener('blur', () => {
        commit();
      });

      altGroup.appendChild(altInput);
      altInput.focus();
      altInput.select();
    });

    altGroup.appendChild(altBtn);
    toolbar.appendChild(altGroup);
    toolbar.appendChild(this.makeDivider());

    // ── Action buttons ──
    const actionGroup = document.createElement('div');
    actionGroup.className = 'cm-image-toolbar-group';

    // View
    const viewBtn = this.makeActionBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>', 'View image', (e) => {
      e.preventDefault();
      const event = new CustomEvent('cascade:open-image-viewer', {
        detail: { src: this.sel.rawUrl },
        bubbles: true,
      });
      view.dom.dispatchEvent(event);
    });

    // Explorer (reveal file)
    const explorerBtn = this.makeActionBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', 'Reveal in Explorer', (e) => {
      e.preventDefault();
      const vaultPath = useVaultStore.getState().vaultPath;
      if (!vaultPath) return;
      const rawUrl = this.sel.rawUrl;
      // rawUrl may be vault-relative or absolute
      const absPath = rawUrl.startsWith('/') || /^[A-Za-z]:/.test(rawUrl)
        ? rawUrl
        : `${vaultPath}/${rawUrl}`.replace(/\\/g, '/');
      revealItemInDir(absPath).catch(() => {/* ignore */});
    });

    // Copy image to clipboard
    const copyBtn = this.makeActionBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>', 'Copy image', (e) => {
      e.preventDefault();
      const img = view.dom.querySelector('.cm-image-widget-selected img') as HTMLImageElement | null;
      if (!img) return;
      fetch(img.src)
        .then((res) => res.blob())
        .then((blob) => {
          const item = new ClipboardItem({ [blob.type]: blob });
          return navigator.clipboard.write([item]);
        })
        .catch(() => {/* ignore clipboard errors */});
    });

    // Delete image markdown
    const deleteBtn = this.makeActionBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', 'Delete image', (e) => {
      e.preventDefault();
      if (!confirm('Delete this image from the document?')) return;
      const line = view.state.doc.lineAt(this.sel.from);
      // Remove entire line including newline if not the last line
      const removeFrom = line.from;
      const removeTo = line.to < view.state.doc.length ? line.to + 1 : line.to;
      view.dispatch({
        changes: { from: removeFrom, to: removeTo, insert: '' },
        effects: deselectImage.of(null),
      });
    });

    actionGroup.appendChild(viewBtn);
    actionGroup.appendChild(explorerBtn);
    actionGroup.appendChild(copyBtn);
    actionGroup.appendChild(deleteBtn);
    toolbar.appendChild(actionGroup);

    return toolbar;
  }

  private makeDivider(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'cm-image-toolbar-divider';
    return div;
  }

  private makeActionBtn(
    icon: string,
    title: string,
    handler: (e: MouseEvent) => void
  ): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'cm-image-toolbar-btn';
    btn.innerHTML = icon;
    btn.title = title;
    btn.addEventListener('mousedown', handler);
    return btn;
  }

  private replaceMarkdown(view: EditorView, newSel: Omit<ImageSelection, 'from' | 'to' | 'src' | 'rawUrl'>) {
    const oldAltField = buildAltWidth(this.sel.alt, this.sel.pipeWidth, this.sel.align);
    const newAltField = buildAltWidth(newSel.alt, newSel.pipeWidth, newSel.align);
    const oldMarkdown = `![${oldAltField}](${this.sel.rawUrl})`;
    const newMarkdown = `![${newAltField}](${this.sel.rawUrl})`;

    const line = view.state.doc.lineAt(this.sel.from);
    const matchIdx = line.text.indexOf(oldMarkdown);

    let replaceFrom = this.sel.from;
    let replaceTo = this.sel.to;
    if (matchIdx !== -1) {
      replaceFrom = line.from + matchIdx;
      replaceTo = replaceFrom + oldMarkdown.length;
    }

    const newTo = replaceFrom + newMarkdown.length;

    view.dispatch({
      changes: { from: replaceFrom, to: replaceTo, insert: newMarkdown },
      effects: selectImage.of({
        from: replaceFrom,
        to: newTo,
        src: this.sel.src,
        rawUrl: this.sel.rawUrl,
        alt: newSel.alt,
        pipeWidth: newSel.pipeWidth,
        align: newSel.align,
      }),
    });
  }

  private applyResize(view: EditorView, pct: number | null) {
    const editorWidth = view.contentDOM.clientWidth;
    const newWidth = pct === null ? null : Math.round(editorWidth * pct);
    this.replaceMarkdown(view, { alt: this.sel.alt, pipeWidth: newWidth, align: this.sel.align });
  }

  private applyAlt(view: EditorView, newAlt: string) {
    this.replaceMarkdown(view, { alt: newAlt, pipeWidth: this.sel.pipeWidth, align: this.sel.align });
  }

  private applyAlign(view: EditorView, newAlign: ImageAlign | null) {
    this.replaceMarkdown(view, { alt: this.sel.alt, pipeWidth: this.sel.pipeWidth, align: newAlign });
  }

  ignoreEvent() {
    return true;
  }
}

// ── Toolbar StateField ───────────────────────────────────────

export const imageToolbarField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(_decos, tr) {
    const sel = tr.state.field(imageSelectionField);
    if (sel === null) return Decoration.none;

    // Rebuild toolbar decoration whenever selection changes
    const widget = new ImageToolbarWidget(sel);
    return Decoration.set([
      Decoration.widget({
        widget,
        block: true,
        side: -1,
      }).range(sel.from),
    ]);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

// ── Theme ────────────────────────────────────────────────────

export const imageControlsTheme = EditorView.baseTheme({
  '.cm-image-toolbar': {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '4px 8px',
    background: 'var(--ctp-surface0)',
    border: '1px solid var(--ctp-surface2)',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    width: 'fit-content',
    margin: '0 auto',
    userSelect: 'none',
    zIndex: '10',
  },
  '.cm-image-toolbar-group': {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  '.cm-image-toolbar-btn': {
    all: 'unset',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28px',
    height: '28px',
    padding: '0 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--ctp-text)',
    cursor: 'pointer',
  },
  '.cm-image-toolbar-btn:hover': {
    background: 'var(--ctp-surface1)',
  },
  '.cm-image-toolbar-active': {
    background: 'var(--ctp-accent) !important',
    color: 'var(--ctp-base) !important',
  },
  '.cm-image-toolbar-divider': {
    width: '1px',
    height: '20px',
    background: 'var(--ctp-surface2)',
    margin: '0 4px',
    flexShrink: '0',
  },
  '.cm-image-toolbar-alt-input': {
    all: 'unset',
    padding: '2px 8px',
    fontSize: '12px',
    color: 'var(--ctp-text)',
    background: 'var(--ctp-surface1)',
    border: '1px solid var(--ctp-surface2)',
    borderRadius: '4px',
    width: '120px',
    marginLeft: '4px',
  },
  '.cm-image-widget-selected': {
    outline: '2px solid var(--ctp-accent)',
    borderRadius: '6px',
  },
});

// ── Combined Export ──────────────────────────────────────────

export function imageControls() {
  return [
    imageSelectionField,
    imageToolbarField,
    imageDeselectOnEscape,
    imageDeselectOnOutsideClick,
    imageControlsTheme,
  ];
}
