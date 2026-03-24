import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { EditorState, Range, StateField, Transaction } from '@codemirror/state';
import { parseQuery } from './query-parser';
import { queryProperties } from '../lib/tauri-commands';
import type { QueryResult } from '../lib/tauri-commands';
import { useVaultStore } from '../stores/vault-store';

// ── Widget ─────────────────────────────────────────────────

class QueryWidget extends WidgetType {
  constructor(readonly code: string) {
    super();
  }

  eq(other: QueryWidget) {
    return this.code === other.code;
  }

  get estimatedHeight(): number {
    return 80; // reasonable default for query result block
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'cm-query-result';

    const query = parseQuery(this.code);

    if (!query) {
      const err = document.createElement('div');
      err.className = 'cm-query-error';
      err.textContent = 'Invalid query: must start with TABLE or LIST';
      wrap.appendChild(err);
      return wrap;
    }

    const loading = document.createElement('div');
    loading.className = 'cm-query-loading';
    loading.textContent = 'Running query…';
    wrap.appendChild(loading);

    // Tell CM to re-measure heights after this widget is mounted
    requestAnimationFrame(() => view.requestMeasure());

    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) {
      wrap.innerHTML = '';
      const err = document.createElement('div');
      err.className = 'cm-query-error';
      err.textContent = 'No vault open';
      wrap.appendChild(err);
      return wrap;
    }

    queryProperties(vaultPath, query)
      .then((result: QueryResult) => {
        wrap.innerHTML = '';
        if (result.rows.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'cm-query-empty';
          empty.textContent = 'No results found';
          wrap.appendChild(empty);
          return;
        }

        if (query.output === 'TABLE') {
          const table = document.createElement('table');
          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');

          const thFile = document.createElement('th');
          thFile.textContent = 'File';
          headerRow.appendChild(thFile);

          for (const field of query.fields) {
            const th = document.createElement('th');
            th.textContent = field;
            headerRow.appendChild(th);
          }
          thead.appendChild(headerRow);
          table.appendChild(thead);

          const tbody = document.createElement('tbody');
          for (const row of result.rows) {
            const tr = document.createElement('tr');

            const tdFile = document.createElement('td');
            const link = document.createElement('a');
            link.className = 'cm-query-link';
            link.textContent = row.fileName;
            link.addEventListener('click', () => {
              document.dispatchEvent(
                new CustomEvent('cascade:open-file', { detail: { path: row.filePath } }),
              );
            });
            tdFile.appendChild(link);
            tr.appendChild(tdFile);

            for (const field of query.fields) {
              const td = document.createElement('td');
              td.textContent = row.values[field] ?? '';
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          wrap.appendChild(table);
        } else {
          // LIST mode
          const ul = document.createElement('ul');
          ul.className = 'cm-query-list';
          for (const row of result.rows) {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'cm-query-link';
            link.textContent = row.fileName;
            link.addEventListener('click', () => {
              document.dispatchEvent(
                new CustomEvent('cascade:open-file', { detail: { path: row.filePath } }),
              );
            });
            li.appendChild(link);
            ul.appendChild(li);
          }
          wrap.appendChild(ul);
        }

        const footer = document.createElement('div');
        footer.className = 'cm-query-footer';
        footer.textContent = `${result.total} result${result.total === 1 ? '' : 's'}`;
        wrap.appendChild(footer);

        // Results rendered — actual height is now known, re-measure
        view.requestMeasure();
      })
      .catch((err: unknown) => {
        wrap.innerHTML = '';
        const errEl = document.createElement('div');
        errEl.className = 'cm-query-error';
        errEl.textContent = `Query error: ${err instanceof Error ? err.message : String(err)}`;
        wrap.appendChild(errEl);
      });

    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

// ── Regex ──────────────────────────────────────────────────

const QUERY_BLOCK_RE = /^[ \t]*```query\s*\n([\s\S]*?)^[ \t]*```\s*$/gm;

// ── Build decorations ──────────────────────────────────────

function buildQueryDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = state.doc;
  const cursor = state.selection.main;
  const text = doc.toString();

  QUERY_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = QUERY_BLOCK_RE.exec(text)) !== null) {
    const rawStart = match.index;
    const rawEnd = match.index + match[0].length;
    const code = match[1].trim();
    if (!code) continue;

    // Snap to line boundaries
    const startLine = doc.lineAt(rawStart);
    const endLine = doc.lineAt(rawEnd);
    const start = startLine.from;
    const end = endLine.to;

    // Don't replace if cursor is inside
    if (cursor.from >= start && cursor.to <= end) continue;

    decorations.push(
      Decoration.replace({
        widget: new QueryWidget(code),
        block: true,
      }).range(start, end),
    );
  }

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

// ── StateField (supports block-level replace decorations) ──

export const queryPreview = StateField.define<DecorationSet>({
  create(state) {
    return buildQueryDecorations(state);
  },
  update(decos, tr: Transaction) {
    if (tr.docChanged || tr.selection) {
      return buildQueryDecorations(tr.state);
    }
    return decos;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

// ── Theme ──────────────────────────────────────────────────

export const queryPreviewTheme = EditorView.theme({
  '.cm-query-result': {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 'var(--ctp-base)',
    border: '1px solid var(--ctp-surface1)',
  },
  '.cm-query-result table': {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  '.cm-query-result th': {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-subtext1)',
    fontWeight: '600',
    padding: '6px 10px',
    textAlign: 'left',
    borderBottom: '1px solid var(--ctp-surface1)',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  '.cm-query-result td': {
    padding: '5px 10px',
    borderBottom: '1px solid var(--ctp-surface0)',
    color: 'var(--ctp-text)',
  },
  '.cm-query-result tr:hover td': {
    backgroundColor: 'var(--ctp-surface0)',
  },
  '.cm-query-link': {
    color: 'var(--ctp-blue)',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  '.cm-query-link:hover': {
    textDecoration: 'underline',
  },
  '.cm-query-list': {
    listStyle: 'disc',
    paddingLeft: '20px',
    margin: '0',
  },
  '.cm-query-list li': {
    padding: '2px 0',
    color: 'var(--ctp-text)',
    fontSize: '13px',
  },
  '.cm-query-footer': {
    marginTop: '8px',
    fontSize: '11px',
    color: 'var(--ctp-overlay0)',
  },
  '.cm-query-loading': {
    padding: '16px',
    textAlign: 'center',
    color: 'var(--ctp-overlay1)',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  '.cm-query-error': {
    padding: '8px 12px',
    color: 'var(--ctp-red)',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  '.cm-query-empty': {
    padding: '12px',
    textAlign: 'center',
    color: 'var(--ctp-overlay0)',
    fontSize: '12px',
  },
});
