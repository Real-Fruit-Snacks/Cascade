import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { type ChangeSet, type EditorState, type Range, StateField } from '@codemirror/state';
import { useToastStore } from '../stores/toast-store';
import { renderInlineMarkdown } from './live-preview/helpers';

// ── Types ──────────────────────────────────────────────────

type Alignment = 'left' | 'center' | 'right' | null;

interface TableData {
  headers: string[];
  rows: string[][];
  alignments: Alignment[];
  from: number;
  to: number;
}

// ── Per-container state (scoped to avoid cross-table bugs) ─

interface TableContainerState {
  lastActiveRow: number;
  lastActiveCol: number;
  suppressBlurSync: boolean;
}

const containerState = new WeakMap<HTMLElement, TableContainerState>();

function getContainerState(container: HTMLElement): TableContainerState {
  let state = containerState.get(container);
  if (!state) {
    state = { lastActiveRow: 0, lastActiveCol: 0, suppressBlurSync: false };
    containerState.set(container, state);
  }
  return state;
}

// ── Parsing ────────────────────────────────────────────────

function parseTableRow(line: string): string[] {
  const trimmed = line.replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function parseAlignments(line: string): Alignment[] {
  return parseTableRow(line).map((cell) => {
    const c = cell.trim();
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-:|]+\|/.test(line) && /\|[\s]*:?-+:?[\s]*\|/.test(line);
}

function parseTable(lines: string[], from: number, to: number): TableData | null {
  if (lines.length < 2) return null;
  if (!isSeparatorRow(lines[1])) return null;

  const headers = parseTableRow(lines[0]);
  const alignments = parseAlignments(lines[1]);
  const rows: string[][] = [];

  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].startsWith('|')) break;
    rows.push(parseTableRow(lines[i]));
  }

  return { headers, rows, alignments, from, to };
}

// ── Formatting ─────────────────────────────────────────────

function formatTable(headers: string[], rows: string[][], alignments: Alignment[]): string {
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length));

  // Pad all rows to the same column count
  const paddedHeaders = Array.from({ length: colCount }, (_, i) => headers[i] ?? '');
  const paddedRows = rows.map((r) =>
    Array.from({ length: colCount }, (_, i) => r[i] ?? ''),
  );

  // Calculate column widths
  const colWidths: number[] = Array(colCount).fill(3);
  for (let col = 0; col < colCount; col++) {
    colWidths[col] = Math.max(colWidths[col], paddedHeaders[col].length);
    for (const row of paddedRows) {
      colWidths[col] = Math.max(colWidths[col], row[col].length);
    }
  }

  function padCell(text: string, width: number, align: Alignment): string {
    if (align === 'right') return text.padStart(width);
    if (align === 'center') {
      const total = width - text.length;
      const left = Math.floor(total / 2);
      const right = total - left;
      return ' '.repeat(left) + text + ' '.repeat(right);
    }
    return text.padEnd(width);
  }

  function formatRow(cells: string[]): string {
    return (
      '| ' +
      cells.map((cell, i) => padCell(cell, colWidths[i], alignments[i] ?? null)).join(' | ') +
      ' |'
    );
  }

  function formatSeparator(): string {
    return (
      '| ' +
      alignments.slice(0, colCount).map((align, i) => {
        const dashes = '-'.repeat(Math.max(1, colWidths[i]));
        if (align === 'center') return `:${dashes.slice(1, -1)}:`;
        if (align === 'right') return `${dashes.slice(1)  }:`;
        if (align === 'left') return `:${dashes.slice(1)}`;
        return dashes;
      }).join(' | ') +
      ' |'
    );
  }

  const lines = [formatRow(paddedHeaders), formatSeparator()];
  for (const row of paddedRows) {
    lines.push(formatRow(row));
  }
  return lines.join('\n');
}

// ── Shared helpers ─────────────────────────────────────────

function collectCurrentData(
  container: HTMLElement,
  rowCount: number,
  colCount: number,
): { currentHeaders: string[]; currentRows: string[][] } {
  const headerCells = container.querySelectorAll<HTMLElement>('[data-row="header"]');
  const currentHeaders = Array.from(headerCells).map((c) => c.dataset.raw ?? c.textContent ?? '');
  const currentRows: string[][] = Array.from({ length: rowCount }, (_, ri) =>
    Array.from({ length: colCount }, (_, ci) => {
      const el = container.querySelector<HTMLElement>(
        `[data-row="${CSS.escape(String(ri))}"][data-col="${CSS.escape(String(ci))}"]`,
      );
      return el?.dataset.raw ?? el?.textContent ?? '';
    }),
  );
  return { currentHeaders, currentRows };
}

// ── Toolbar ────────────────────────────────────────────────

function updateLastActive(cell: HTMLElement, container: HTMLElement): void {
  const state = getContainerState(container);
  const rowAttr = cell.dataset.row;
  const colAttr = cell.dataset.col;
  if (rowAttr !== undefined) state.lastActiveRow = rowAttr === 'header' ? -1 : parseInt(rowAttr, 10);
  if (colAttr !== undefined) state.lastActiveCol = parseInt(colAttr, 10);
}

function createToolbar(
  headers: string[],
  rows: string[][],
  alignments: Alignment[],
  from: number,
  to: number,
  view: EditorView,
  container: HTMLElement,
): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'cm-table-editor-toolbar';
  const state = getContainerState(container);

  function getData(): { currentHeaders: string[]; currentRows: string[][] } {
    return collectCurrentData(container, rows.length, headers.length);
  }

  function getActiveRowCol(): { rowIdx: number; colIdx: number } {
    return { rowIdx: state.lastActiveRow, colIdx: state.lastActiveCol };
  }

  function dispatch(
    newHeaders: string[],
    newRows: string[][],
    newAlignments: Alignment[],
  ) {
    const newText = formatTable(newHeaders, newRows, newAlignments);
    state.suppressBlurSync = true;
    view.dispatch({ changes: { from, to, insert: newText } });
    // Delay reset so any blur events from widget removal are still suppressed
    requestAnimationFrame(() => { state.suppressBlurSync = false; });
  }

  function btn(label: string, title: string, onClick: () => void, kind?: 'add' | 'del'): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.className = 'cm-table-editor-toolbar-btn' + (kind ? ` cm-table-editor-btn-${kind}` : '');
    b.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onClick();
    });
    return b;
  }

  function sep(): HTMLElement {
    const s = document.createElement('span');
    s.className = 'cm-table-editor-toolbar-sep';
    return s;
  }

  toolbar.append(
    btn('Row above', 'Add row above active row', () => {
      const { currentHeaders, currentRows } = getData();
      const { rowIdx } = getActiveRowCol();
      // Can't add above the header row
      if (rowIdx < 0) {
        useToastStore.getState().addToast('Cannot add a row above the header', 'info', 3000);
        return;
      }
      const newRow = Array(currentHeaders.length).fill('');
      const newRows = [...currentRows.slice(0, rowIdx), newRow, ...currentRows.slice(rowIdx)];
      dispatch(currentHeaders, newRows, alignments);
    }, 'add'),
    btn('Row below', 'Add row below active row', () => {
      const { currentHeaders, currentRows } = getData();
      const { rowIdx } = getActiveRowCol();
      // Header (-1) → insert at 0 (below header = top of body); body row N → insert at N+1
      const insertAt = rowIdx < 0 ? 0 : rowIdx + 1;
      const newRow = Array(currentHeaders.length).fill('');
      const newRows = [...currentRows.slice(0, insertAt), newRow, ...currentRows.slice(insertAt)];
      dispatch(currentHeaders, newRows, alignments);
    }, 'add'),
    btn('Col left', 'Add column left of active column', () => {
      const { currentHeaders, currentRows } = getData();
      const { colIdx } = getActiveRowCol();
      const at = Math.max(0, colIdx);
      dispatch(
        [...currentHeaders.slice(0, at), '', ...currentHeaders.slice(at)],
        currentRows.map((r) => [...r.slice(0, at), '', ...r.slice(at)]),
        [...alignments.slice(0, at), null, ...alignments.slice(at)],
      );
    }, 'add'),
    btn('Col right', 'Add column right of active column', () => {
      const { currentHeaders, currentRows } = getData();
      const { colIdx } = getActiveRowCol();
      const at = colIdx + 1;
      dispatch(
        [...currentHeaders.slice(0, at), '', ...currentHeaders.slice(at)],
        currentRows.map((r) => [...r.slice(0, at), '', ...r.slice(at)]),
        [...alignments.slice(0, at), null, ...alignments.slice(at)],
      );
    }, 'add'),
    sep(),
    btn('Del row', 'Delete active row', () => {
      const { currentHeaders, currentRows } = getData();
      if (currentRows.length === 0) return;
      const { rowIdx } = getActiveRowCol();
      const delIdx = rowIdx < 0 ? 0 : Math.min(rowIdx, currentRows.length - 1);
      dispatch(currentHeaders, currentRows.filter((_, i) => i !== delIdx), alignments);
    }, 'del'),
    btn('Del col', 'Delete active column', () => {
      const { currentHeaders, currentRows } = getData();
      if (currentHeaders.length <= 1) return;
      const { colIdx } = getActiveRowCol();
      const delIdx = Math.min(colIdx, currentHeaders.length - 1);
      dispatch(
        currentHeaders.filter((_, i) => i !== delIdx),
        currentRows.map((r) => r.filter((_, i) => i !== delIdx)),
        alignments.filter((_, i) => i !== delIdx),
      );
    }, 'del'),
    sep(),
    btn('Left', 'Align active column left', () => {
      const { currentHeaders, currentRows } = getData();
      const { colIdx } = getActiveRowCol();
      const newAlignments = [...alignments];
      if (colIdx >= 0 && colIdx < newAlignments.length) newAlignments[colIdx] = 'left';
      dispatch(currentHeaders, currentRows, newAlignments);
    }),
    btn('Center', 'Align active column center', () => {
      const { currentHeaders, currentRows } = getData();
      const { colIdx } = getActiveRowCol();
      const newAlignments = [...alignments];
      if (colIdx >= 0 && colIdx < newAlignments.length) newAlignments[colIdx] = 'center';
      dispatch(currentHeaders, currentRows, newAlignments);
    }),
    btn('Right', 'Align active column right', () => {
      const { currentHeaders, currentRows } = getData();
      const { colIdx } = getActiveRowCol();
      const newAlignments = [...alignments];
      if (colIdx >= 0 && colIdx < newAlignments.length) newAlignments[colIdx] = 'right';
      dispatch(currentHeaders, currentRows, newAlignments);
    }),
    sep(),
    btn('Del table', 'Delete entire table', () => {
      state.suppressBlurSync = true;
      view.dispatch({ changes: { from, to, insert: '' } });
      requestAnimationFrame(() => { state.suppressBlurSync = false; });
    }, 'del'),
  );

  return toolbar;
}

// ── Widget ─────────────────────────────────────────────────

class InteractiveTableWidget extends WidgetType {
  constructor(
    readonly headers: string[],
    readonly rows: string[][],
    readonly alignments: Alignment[],
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }

  eq(other: InteractiveTableWidget): boolean {
    if (this.from !== other.from || this.to !== other.to) return false;
    if (this.headers.length !== other.headers.length) return false;
    if (this.rows.length !== other.rows.length) return false;
    if (this.alignments.length !== other.alignments.length) return false;
    if (!this.headers.every((h, i) => h === other.headers[i])) return false;
    if (!this.alignments.every((a, i) => a === other.alignments[i])) return false;
    return this.rows.every((row, i) => {
      const otherRow = other.rows[i];
      return row.length === otherRow.length && row.every((c, j) => c === otherRow[j]);
    });
  }

  get estimatedHeight(): number {
    // container chrome (~10px) + header row (~30px) + data rows (~30px each)
    return 10 + 30 + this.rows.length * 30;
  }

  toDOM(view: EditorView): HTMLElement {
    const { headers, rows, alignments, from, to } = this;
    const isEditable = view.state.facet(EditorView.editable);

    const container = document.createElement('div');
    container.className = 'cm-table-editor';
    container.setAttribute('data-table-from', String(from));
    container.setAttribute('data-table-to', String(to));

    // Show toolbar when any element inside the container is focused
    container.addEventListener('focusin', () => {
      container.classList.add('cm-table-editor-focused');
    });
    container.addEventListener('focusout', () => {
      // Delay check — mousedown preventDefault means relatedTarget may be null momentarily
      requestAnimationFrame(() => {
        if (!container.contains(document.activeElement) && !container.matches(':hover')) {
          container.classList.remove('cm-table-editor-focused');
        }
      });
    });

    // Toolbar
    const toolbar = createToolbar(headers, rows, alignments, from, to, view, container);
    container.appendChild(toolbar);

    // Table
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'cm-table-editor-wrapper';

    const table = document.createElement('table');
    table.className = 'cm-table-editor-table';

    // Header row
    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    headers.forEach((h, colIdx) => {
      const th = document.createElement('th');
      th.className = 'cm-table-editor-cell cm-table-editor-header-cell';
      th.contentEditable = isEditable ? 'true' : 'false';
      th.innerHTML = renderInlineMarkdown(h);
      th.dataset.row = 'header';
      th.dataset.col = String(colIdx);
      th.dataset.raw = h;
      if (alignments[colIdx]) th.style.textAlign = alignments[colIdx]!;
      if (isEditable) attachCellHandlers(th, view, container, headers, rows, alignments, from, to);
      headerTr.appendChild(th);
    });
    thead.appendChild(headerTr);
    table.appendChild(thead);

    // Body rows
    const tbody = document.createElement('tbody');
    rows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      row.forEach((cell, colIdx) => {
        const td = document.createElement('td');
        td.className = 'cm-table-editor-cell';
        td.contentEditable = isEditable ? 'true' : 'false';
        td.innerHTML = renderInlineMarkdown(cell);
        td.dataset.row = String(rowIdx);
        td.dataset.col = String(colIdx);
        td.dataset.raw = cell;
        if (alignments[colIdx]) td.style.textAlign = alignments[colIdx]!;
        if (isEditable) attachCellHandlers(td, view, container, headers, rows, alignments, from, to);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);

    // Tell CM to re-measure heights after this widget is mounted
    requestAnimationFrame(() => view.requestMeasure());

    return container;
  }

  ignoreEvent(): boolean {
    // Let the widget handle all events (clicks, keys, focus) internally
    return true;
  }
}

// ── Cell event handlers ────────────────────────────────────

function attachCellHandlers(
  cell: HTMLElement,
  view: EditorView,
  container: HTMLElement,
  headers: string[],
  rows: string[][],
  alignments: Alignment[],
  from: number,
  to: number,
): void {
  const state = getContainerState(container);

  function getData(): { currentHeaders: string[]; currentRows: string[][] } {
    return collectCurrentData(container, rows.length, headers.length);
  }

  function syncToEditor(): void {
    if (state.suppressBlurSync) return;
    const { currentHeaders, currentRows } = getData();
    const newText = formatTable(currentHeaders, currentRows, alignments);
    // Only dispatch if changed
    const oldText = view.state.doc.sliceString(from, to);
    if (newText !== oldText) {
      state.suppressBlurSync = true;
      view.dispatch({ changes: { from, to, insert: newText } });
      requestAnimationFrame(() => { state.suppressBlurSync = false; });
    }
  }

  function getAllCells(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('.cm-table-editor-cell'));
  }

  function focusCell(el: HTMLElement): void {
    container.querySelectorAll('.cm-table-editor-cell-active').forEach((c) =>
      c.classList.remove('cm-table-editor-cell-active'),
    );
    el.classList.add('cm-table-editor-cell-active');
    el.focus();
    // Place cursor at end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  cell.addEventListener('focus', () => {
    container.querySelectorAll('.cm-table-editor-cell-active').forEach((c) =>
      c.classList.remove('cm-table-editor-cell-active'),
    );
    cell.classList.add('cm-table-editor-cell-active');
    // Switch to raw markdown for editing
    const raw = cell.dataset.raw ?? cell.textContent ?? '';
    cell.textContent = raw;
    updateLastActive(cell, container);
  });

  cell.addEventListener('blur', () => {
    cell.classList.remove('cm-table-editor-cell-active');
    // Store raw content and render inline markdown for display
    const raw = cell.textContent ?? '';
    cell.dataset.raw = raw;
    cell.innerHTML = renderInlineMarkdown(raw);
    if (!state.suppressBlurSync) syncToEditor();
  });

  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cell.blur();
      // Move cursor past the table in the editor
      const docTo = view.state.doc.length;
      const safePos = Math.min(to + 1, docTo);
      view.dispatch({ selection: { anchor: safePos } });
      view.focus();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      syncToEditor();

      const allCells = getAllCells();
      const idx = allCells.indexOf(cell);
      if (e.shiftKey) {
        if (idx > 0) {
          focusCell(allCells[idx - 1]);
        }
      } else {
        if (idx < allCells.length - 1) {
          focusCell(allCells[idx + 1]);
        } else {
          // Last cell: add a new row
          const { currentHeaders, currentRows } = getData();
          const newRow = Array(currentHeaders.length).fill('');
          const newRows = [...currentRows, newRow];
          const newText = formatTable(currentHeaders, newRows, alignments);
          state.suppressBlurSync = true;
          view.dispatch({ changes: { from, to, insert: newText } });
          requestAnimationFrame(() => { state.suppressBlurSync = false; });
        }
      }
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const rowAttr = cell.dataset.row;
      const colAttr = cell.dataset.col;
      if (rowAttr === undefined || colAttr === undefined) return;

      const colIdx = parseInt(colAttr, 10);
      let targetRow: string;

      if (e.key === 'ArrowUp') {
        if (rowAttr === 'header') return; // already at top
        if (rowAttr === '0') targetRow = 'header';
        else targetRow = String(parseInt(rowAttr, 10) - 1);
      } else {
        if (rowAttr === 'header') targetRow = '0';
        else {
          const nextIdx = parseInt(rowAttr, 10) + 1;
          if (nextIdx >= rows.length) return; // already at bottom
          targetRow = String(nextIdx);
        }
      }

      const targetCell = container.querySelector<HTMLElement>(
        `[data-row="${CSS.escape(targetRow)}"][data-col="${CSS.escape(String(colIdx))}"]`,
      );
      if (targetCell) {
        e.preventDefault();
        focusCell(targetCell);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      syncToEditor();

      const rowAttr = cell.dataset.row;
      const colAttr = cell.dataset.col;
      if (rowAttr === undefined || colAttr === undefined) return;

      const colIdx = parseInt(colAttr, 10);
      const isLastRow = rowAttr !== 'header' && parseInt(rowAttr, 10) === rows.length - 1;

      if (isLastRow) {
        // Add a new row
        const { currentHeaders, currentRows } = getData();
        const newRow = Array(currentHeaders.length).fill('');
        const newRows = [...currentRows, newRow];
        const newText = formatTable(currentHeaders, newRows, alignments);
        state.suppressBlurSync = true;
        view.dispatch({ changes: { from, to, insert: newText } });
        requestAnimationFrame(() => { state.suppressBlurSync = false; });
      } else {
        // Move to same column in next row
        const nextRowIdx = rowAttr === 'header' ? 0 : parseInt(rowAttr, 10) + 1;
        const nextCell = container.querySelector<HTMLElement>(
          `[data-row="${CSS.escape(String(nextRowIdx))}"][data-col="${CSS.escape(String(colIdx))}"]`,
        );
        if (nextCell) focusCell(nextCell);
      }
    }
  });

  // Prevent paste from injecting HTML
  cell.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    }
  });
}

// ── Build decorations from state (no view needed) ─────────

function buildTableDecorationsFromState(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = state.doc;
  let lineNum = 1;

  while (lineNum <= doc.lines) {
    const line = doc.line(lineNum);

    if (!line.text.startsWith('|')) {
      lineNum++;
      continue;
    }

    // Collect all consecutive table lines
    const tableLines: string[] = [];
    const tableStart = line.from;
    let tableEnd = line.to;
    let scanLine = lineNum;

    while (scanLine <= doc.lines) {
      const l = doc.line(scanLine);
      if (!l.text.startsWith('|')) break;
      tableLines.push(l.text);
      tableEnd = l.to;
      scanLine++;
    }

    // Need at least 2 lines (header + separator)
    if (tableLines.length >= 2 && isSeparatorRow(tableLines[1])) {
      const parsed = parseTable(tableLines, tableStart, tableEnd);
      if (parsed) {
        decorations.push(
          Decoration.replace({
            widget: new InteractiveTableWidget(
              parsed.headers,
              parsed.rows,
              parsed.alignments,
              tableStart,
              tableEnd,
            ),
            block: true,
          }).range(tableStart, tableEnd),
        );
      }
    }

    lineNum = scanLine;
  }

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

// ── Check if changes affect table regions ──────────────────

function changesOverlapTables(changes: ChangeSet, decorations: DecorationSet): boolean {
  let overlaps = false;
  changes.iterChangedRanges((fromA, toA) => {
    decorations.between(fromA, toA, () => {
      overlaps = true;
    });
  });
  return overlaps;
}

// ── StateField (block decorations require StateField, not ViewPlugin) ───

const tableEditorField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorationsFromState(state);
  },
  update(decorations, tr) {
    if (!tr.docChanged) return decorations;
    // Check if any change touches a line starting with | (potential table)
    // or overlaps existing table decorations — if so, rebuild
    let touchesTableLine = false;
    tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
      // Check lines in the new document that were affected
      const startLine = tr.state.doc.lineAt(fromB).number;
      const endLine = tr.state.doc.lineAt(Math.min(toB, tr.state.doc.length)).number;
      for (let l = startLine; l <= endLine; l++) {
        if (tr.state.doc.line(l).text.startsWith('|')) {
          touchesTableLine = true;
          break;
        }
      }
    });
    if (touchesTableLine || changesOverlapTables(tr.changes, decorations)) {
      return buildTableDecorationsFromState(tr.state);
    }
    // No table-relevant changes — just map positions forward
    return decorations.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const tableEditor = [tableEditorField];

// ── Theme ──────────────────────────────────────────────────

export const tableEditorTheme = EditorView.theme({
  '.cm-table-editor': {
    display: 'block',
    padding: '4px 0',
    border: '1px solid var(--ctp-surface1)',
    borderRadius: '6px',
    overflow: 'hidden',
    background: 'var(--ctp-surface0)',
  },
  '.cm-table-editor-toolbar': {
    display: 'none',
    alignItems: 'center',
    gap: '2px',
    padding: '4px 6px',
    background: 'var(--ctp-surface1)',
    borderBottom: '1px solid var(--ctp-surface2)',
    flexWrap: 'wrap',
  },
  '.cm-table-editor-focused .cm-table-editor-toolbar': {
    display: 'flex',
  },
  '.cm-table-editor-toolbar-btn': {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '3px',
    border: '1px solid var(--ctp-surface2)',
    background: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    cursor: 'pointer',
    lineHeight: '1.4',
    whiteSpace: 'nowrap',
  },
  '.cm-table-editor-toolbar-btn:hover': {
    background: 'var(--ctp-surface2)',
    borderColor: 'var(--ctp-accent)',
  },
  '.cm-table-editor-btn-add:hover': {
    color: 'var(--ctp-green)',
    borderColor: 'var(--ctp-green)',
  },
  '.cm-table-editor-btn-del:hover': {
    color: 'var(--ctp-red)',
    borderColor: 'var(--ctp-red)',
  },
  '.cm-table-editor-toolbar-sep': {
    width: '1px',
    height: '16px',
    background: 'var(--ctp-surface2)',
    margin: '0 2px',
    display: 'inline-block',
  },
  '.cm-table-editor-wrapper': {
    overflowX: 'auto',
  },
  '.cm-table-editor-table': {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: 'inherit',
  },
  '.cm-table-editor-cell': {
    padding: '4px 8px',
    border: '1px solid var(--ctp-surface1)',
    color: 'var(--ctp-text)',
    background: 'var(--ctp-base)',
    minWidth: '60px',
    outline: 'none',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  '.cm-table-editor-header-cell': {
    background: 'var(--ctp-surface0)',
    fontWeight: 'bold',
  },
  '.cm-table-editor-cell-active': {
    background: 'var(--ctp-surface1) !important',
    boxShadow: 'inset 0 0 0 2px var(--ctp-accent)',
  },
  '.cm-table-editor-cell:hover': {
    background: 'var(--ctp-surface0)',
  },
});
