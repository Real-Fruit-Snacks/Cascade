import { EditorView, WidgetType } from '@codemirror/view';
import { useVaultStore } from '../../stores/vault-store';
import { selectImage, deselectImage, imageSelectionField, parseAltWidth } from '../image-controls';
import { readFile } from '../../lib/tauri-commands';
import {
  parseTableRow,
  parseAlignments,
  extractHeadingSection,
  extractBlockSection,
  renderMarkdownPreview,
} from './helpers';

// ── Widgets ────────────────────────────────────────────────

export class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr');
    hr.className = 'cm-hr-widget';
    return hr;
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: CheckboxWidget) {
    return this.checked === other.checked;
  }
  toDOM(view: EditorView) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = this.checked;
    cb.className = 'cm-checkbox-widget';
    cb.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const pos = view.posAtDOM(cb);
      const line = view.state.doc.lineAt(pos);
      const checkMatch = line.text.match(/^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]/);
      if (checkMatch) {
        const bracketPos = line.from + checkMatch[1].length + 1;
        const newChar = this.checked ? ' ' : 'x';
        view.dispatch({
          changes: { from: bracketPos, to: bracketPos + 1, insert: newChar },
        });
      }
    });
    return cb;
  }
}

export class TableWidget extends WidgetType {
  constructor(readonly headers: string[], readonly rows: string[][], readonly alignments: ('left' | 'center' | 'right' | null)[]) {
    super();
  }
  eq(other: TableWidget) {
    if (this.headers.length !== other.headers.length || this.rows.length !== other.rows.length) return false;
    for (let i = 0; i < this.headers.length; i++) {
      if (this.headers[i] !== other.headers[i]) return false;
    }
    for (let i = 0; i < this.rows.length; i++) {
      const a = this.rows[i], b = other.rows[i];
      if (a.length !== b.length) return false;
      for (let j = 0; j < a.length; j++) {
        if (a[j] !== b[j]) return false;
      }
    }
    return true;
  }
  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'block';
    const table = document.createElement('table');
    table.className = 'cm-table-widget';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    this.headers.forEach((h, i) => {
      const th = document.createElement('th');
      th.textContent = h.trim();
      if (this.alignments[i]) th.style.textAlign = this.alignments[i]!;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.rows.forEach((row) => {
      const tr = document.createElement('tr');
      row.forEach((cell, i) => {
        const td = document.createElement('td');
        td.textContent = cell.trim();
        if (this.alignments[i]) td.style.textAlign = this.alignments[i]!;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  }
  ignoreEvent() { return false; }
}

// SECURITY: Images (including SVGs) are rendered via <img> tags, which
// prevent script execution in SVG files. Do NOT change to <object>,
// <embed>, <iframe>, or inline SVG without adding SVG sanitization first.
export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly rawUrl: string,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }
  eq(other: ImageWidget) {
    return this.src === other.src && this.from === other.from && this.to === other.to;
  }
  toDOM(view: EditorView) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-image-widget';

    // Check if this image is currently selected
    const sel = view.state.field(imageSelectionField, false);
    if (sel && sel.from === this.from && sel.to === this.to) {
      wrapper.classList.add('cm-image-widget-selected');
    }

    const { alt: cleanAlt, width: pipeWidth, align } = parseAltWidth(this.alt);

    if (align) {
      const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
      wrapper.style.display = 'flex';
      wrapper.style.justifyContent = alignMap[align];
    }

    const img = document.createElement('img');
    img.src = this.src;
    img.alt = cleanAlt;
    img.className = 'cm-image-embed';
    img.draggable = false;
    if (pipeWidth != null) {
      img.style.maxWidth = pipeWidth + 'px';
    }
    img.addEventListener('error', () => {
      wrapper.textContent = `[Image not found: ${this.alt || this.src}]`;
      wrapper.style.color = 'var(--ctp-overlay0)';
      wrapper.style.fontStyle = 'italic';
      wrapper.style.fontSize = '0.85em';
      wrapper.style.padding = '4px 0';
    });

    wrapper.addEventListener('mousedown', (e) => {
      if (this.from === -1) return;
      e.preventDefault();
      e.stopPropagation();
      const currentSel = view.state.field(imageSelectionField, false);
      if (currentSel && currentSel.from === this.from) {
        // Already selected — deselect
        view.dispatch({ effects: deselectImage.of(null) });
      } else {
        // Select this image
        const { alt: parsedAlt, width: parsedWidth, align: parsedAlign } = parseAltWidth(this.alt);
        view.dispatch({
          effects: selectImage.of({
            from: this.from,
            to: this.to,
            src: this.src,
            rawUrl: this.rawUrl,
            alt: parsedAlt,
            pipeWidth: parsedWidth,
            align: parsedAlign,
          }),
        });
      }
    });

    wrapper.appendChild(img);
    return wrapper;
  }
  ignoreEvent() { return true; }
}

// ── Code block widgets ─────────────────────────────────────

export class CopyButtonWidget extends WidgetType {
  constructor(readonly code: string) {
    super();
  }
  eq(other: CopyButtonWidget) {
    return this.code === other.code;
  }
  toDOM() {
    const btn = document.createElement('button');
    btn.className = 'cm-copy-button';
    btn.textContent = 'Copy';
    btn.title = 'Copy to clipboard';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(this.code).then(() => {
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      }).catch(() => {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
    return btn;
  }
  ignoreEvent() { return true; }
}

export class CodeLineNumberWidget extends WidgetType {
  constructor(readonly lineNum: number) {
    super();
  }
  eq(other: CodeLineNumberWidget) {
    return this.lineNum === other.lineNum;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-codeblock-line-number';
    span.textContent = String(this.lineNum);
    return span;
  }
}

// ── Callout widget ─────────────────────────────────────────

export class CalloutHeaderWidget extends WidgetType {
  constructor(
    readonly icon: string,
    readonly title: string,
    readonly colorClass: string,
  ) {
    super();
  }
  eq(other: CalloutHeaderWidget) {
    return this.icon === other.icon && this.title === other.title && this.colorClass === other.colorClass;
  }
  toDOM() {
    const wrapper = document.createElement('span');
    wrapper.className = `cm-callout-header cm-callout-${this.colorClass}`;

    const titleEl = document.createElement('span');
    titleEl.className = 'cm-callout-title';
    titleEl.textContent = this.title;

    wrapper.appendChild(titleEl);
    return wrapper;
  }
}

// ── Transclusion widget ────────────────────────────────────

const MAX_TRANSCLUSION_DEPTH = 3;

export class TransclusionWidget extends WidgetType {
  private _dom: HTMLElement | null = null;

  constructor(
    readonly filePath: string,
    readonly linkText: string,
    readonly heading: string | null = null,
    readonly blockId: string | null = null,
    readonly depth: number = 0,
  ) {
    super();
  }

  eq(other: TransclusionWidget) {
    return this.filePath === other.filePath && this.linkText === other.linkText
      && this.heading === other.heading && this.blockId === other.blockId
      && this.depth === other.depth;
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-transclusion-widget';

    const header = document.createElement('div');
    header.className = 'cm-transclusion-header';
    let baseName = this.linkText.split('/').pop()?.replace(/\.md$/i, '') ?? this.linkText;
    if (this.heading) baseName += ` > ${this.heading}`;
    header.textContent = baseName;
    wrapper.appendChild(header);

    const body = document.createElement('div');
    body.className = 'cm-transclusion-body';
    body.textContent = 'Loading…';
    wrapper.appendChild(body);

    this._dom = body;

    // Depth-based cycle / nesting limit
    if (this.depth >= MAX_TRANSCLUSION_DEPTH) {
      body.textContent = '[Circular embed detected]';
      body.classList.add('cm-transclusion-error');
      return wrapper;
    }

    const vaultPath = useVaultStore.getState().vaultPath;
    if (vaultPath) {
      readFile(vaultPath, this.filePath).then((content) => {
        if (!this._dom) return;

        let text: string;
        if (this.heading) {
          const section = extractHeadingSection(content, this.heading);
          text = section ?? `[Heading "${this.heading}" not found]`;
        } else if (this.blockId) {
          const block = extractBlockSection(content, this.blockId);
          text = block ?? `[Block "^${this.blockId}" not found]`;
        } else {
          text = content;
        }

        this._dom.innerHTML = renderMarkdownPreview(text);
      }).catch(() => {
        if (!this._dom) return;
        this._dom.textContent = `[Could not read: ${this.linkText}]`;
        this._dom.classList.add('cm-transclusion-error');
      });
    }

    return wrapper;
  }

  destroy() {
    this._dom = null;
  }

  ignoreEvent() { return false; }
}

// Re-export parseTableRow and parseAlignments for use in build-decorations
export { parseTableRow, parseAlignments };
