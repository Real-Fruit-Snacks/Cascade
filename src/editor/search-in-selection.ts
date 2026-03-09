import { EditorView, Panel } from '@codemirror/view';
import { EditorState, ChangeDesc } from '@codemirror/state';
import {
  SearchQuery,
  getSearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
  closeSearchPanel,
} from '@codemirror/search';

// Tracks the pinned selection range for "in selection" mode
interface SelectionRange {
  from: number;
  to: number;
}

// Build a SearchQuery that filters matches to the pinned range
function buildSelectionQuery(base: SearchQuery, range: SelectionRange): SearchQuery {
  return new SearchQuery({
    search: base.search,
    caseSensitive: base.caseSensitive,
    literal: base.literal,
    regexp: base.regexp,
    replace: base.replace,
    wholeWord: base.wholeWord,
    test: (match: string, state: EditorState, from: number, to: number) => {
      const inRange = from >= range.from && to <= range.to;
      if (!inRange) return false;
      // Honour any existing test on the base query
      if (base.test) return base.test(match, state, from, to);
      return true;
    },
  });
}

function elt(tag: string, attrs: Record<string, string>, ...children: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const child of children) {
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

function btn(label: string, name: string, title: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.name = name;
  b.title = title;
  b.className = 'cm-button';
  return b;
}

function togglePill(id: string, labelText: string, checked: boolean): { wrap: HTMLLabelElement; input: HTMLInputElement } {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;

  const wrap = document.createElement('label');
  wrap.htmlFor = id;
  wrap.append(input, document.createTextNode(labelText));
  return { wrap, input };
}

export function createSearchPanel(view: EditorView): Panel {
  // State local to this panel instance
  let pinnedRange: SelectionRange | null = null;
  let inSelectionActive = false;

  // --- DOM construction ---

  const findInput = document.createElement('input');
  findInput.type = 'text';
  findInput.placeholder = 'Find';
  findInput.className = 'cm-textfield';
  findInput.setAttribute('main-field', 'true');

  const replaceInput = document.createElement('input');
  replaceInput.type = 'text';
  replaceInput.placeholder = 'Replace';
  replaceInput.className = 'cm-textfield';

  const btnNext = btn('▼', 'next', 'Next match (Enter)');
  const btnPrev = btn('▲', 'prev', 'Previous match');
  const btnAll = btn('Select all', 'select', 'Select all matches');
  const btnReplace = btn('Replace', 'replace', 'Replace this match');
  const btnReplaceAll = btn('Replace all', 'replaceAll', 'Replace all matches');
  const btnClose = btn('✕', 'close', 'Close search panel');

  const { wrap: caseWrap, input: caseInput } = togglePill('cm-search-case', 'Aa', false);
  caseWrap.title = 'Match case (Alt+C)';
  const { wrap: reWrap, input: reInput } = togglePill('cm-search-re', '.*', false);
  reWrap.title = 'Regular expression (Alt+R)';
  const { wrap: wordWrap, input: wordInput } = togglePill('cm-search-word', 'W', false);
  wordWrap.title = 'Whole word (Alt+W)';
  const { wrap: selWrap, input: selInput } = togglePill('cm-search-sel', 'In selection', false);
  selWrap.title = 'Search in selection only (Alt+L)';

  // Layout: two rows
  const row1 = elt(
    'div',
    { style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;' },
    findInput,
    btnPrev,
    btnNext,
    btnAll,
    elt('span', { style: 'flex:1' }),
    caseWrap,
    reWrap,
    wordWrap,
    selWrap,
    btnClose,
  );

  const row2 = elt(
    'div',
    { style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;' },
    replaceInput,
    btnReplace,
    btnReplaceAll,
  );

  const dom = elt('div', { class: 'cm-panel cm-search', style: 'padding:8px 12px;' }, row1, row2);

  // --- Helpers ---

  function commit() {
    const base = new SearchQuery({
      search: findInput.value,
      caseSensitive: caseInput.checked,
      literal: false,
      regexp: reInput.checked,
      replace: replaceInput.value,
      wholeWord: wordInput.checked,
    });

    let query: SearchQuery;
    if (inSelectionActive && pinnedRange) {
      query = buildSelectionQuery(base, pinnedRange);
    } else {
      query = base;
    }

    view.dispatch({ effects: setSearchQuery.of(query) });
  }

  function syncFromState(state: EditorState) {
    const q = getSearchQuery(state);
    if (findInput.value !== q.search) findInput.value = q.search;
    if (replaceInput.value !== q.replace) replaceInput.value = q.replace;
    caseInput.checked = q.caseSensitive;
    reInput.checked = q.regexp;
    wordInput.checked = q.wholeWord;
  }

  // --- Event wiring ---

  findInput.addEventListener('input', commit);
  replaceInput.addEventListener('input', commit);
  caseInput.addEventListener('change', commit);
  reInput.addEventListener('change', commit);
  wordInput.addEventListener('change', commit);

  selInput.addEventListener('change', () => {
    inSelectionActive = selInput.checked;
    if (inSelectionActive) {
      // Capture current selection range
      const sel = view.state.selection.main;
      if (sel.from !== sel.to) {
        pinnedRange = { from: sel.from, to: sel.to };
      } else {
        // No selection — deactivate immediately
        inSelectionActive = false;
        selInput.checked = false;
        return;
      }
    } else {
      pinnedRange = null;
    }
    commit();
  });

  btnNext.addEventListener('click', () => { findNext(view); view.focus(); });
  btnPrev.addEventListener('click', () => { findPrevious(view); view.focus(); });
  btnAll.addEventListener('click', () => {
    // Use selectMatches command (re-import inline to avoid circular concerns)
    import('@codemirror/search').then(({ selectMatches }) => {
      selectMatches(view);
      view.focus();
    });
  });
  btnReplace.addEventListener('click', () => { replaceNext(view); view.focus(); });
  btnReplaceAll.addEventListener('click', () => { replaceAll(view); view.focus(); });
  btnClose.addEventListener('click', () => { closeSearchPanel(view); view.focus(); });

  // Keyboard shortcuts within the panel
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) findPrevious(view);
      else findNext(view);
    } else if (e.key === 'Escape') {
      closeSearchPanel(view);
      view.focus();
    } else if (e.altKey) {
      handleAlt(e);
    }
  });

  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      replaceNext(view);
    } else if (e.key === 'Escape') {
      closeSearchPanel(view);
      view.focus();
    } else if (e.altKey) {
      handleAlt(e);
    }
  });

  function handleAlt(e: KeyboardEvent) {
    if (e.key === 'c' || e.key === 'C') {
      caseInput.checked = !caseInput.checked;
      caseInput.dispatchEvent(new Event('change'));
      e.preventDefault();
    } else if (e.key === 'r' || e.key === 'R') {
      reInput.checked = !reInput.checked;
      reInput.dispatchEvent(new Event('change'));
      e.preventDefault();
    } else if (e.key === 'w' || e.key === 'W') {
      wordInput.checked = !wordInput.checked;
      wordInput.dispatchEvent(new Event('change'));
      e.preventDefault();
    } else if (e.key === 'l' || e.key === 'L') {
      selInput.checked = !selInput.checked;
      selInput.dispatchEvent(new Event('change'));
      e.preventDefault();
    }
  }

  // Also handle Alt+L from the outer editor when panel is focused
  dom.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'l' || e.key === 'L')) {
      selInput.checked = !selInput.checked;
      selInput.dispatchEvent(new Event('change'));
      e.preventDefault();
    }
  });

  return {
    dom,
    top: true,
    mount() {
      syncFromState(view.state);
      findInput.focus();
      findInput.select();
    },
    update(update) {
      // Map the pinned range through any document changes
      if (pinnedRange && update.docChanged) {
        const changeDesc: ChangeDesc = update.changes;
        const newFrom = changeDesc.mapPos(pinnedRange.from, 1);
        const newTo = changeDesc.mapPos(pinnedRange.to, -1);
        if (newFrom < newTo) {
          pinnedRange = { from: newFrom, to: newTo };
          // Recommit with updated range
          commit();
        } else {
          // Range collapsed — turn off in-selection mode
          inSelectionActive = false;
          selInput.checked = false;
          pinnedRange = null;
          commit();
        }
      }

      // Sync inputs if an external effect changed the query
      if (update.transactions.some(tr => tr.effects.some(e => e.is(setSearchQuery)))) {
        syncFromState(update.state);
      }
    },
    destroy() {
      // Nothing to clean up; DOM is discarded with the panel
    },
  };
}
