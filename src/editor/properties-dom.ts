import { EditorView } from '@codemirror/view';
import { useVaultStore } from '../stores/vault-store';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';
import { resolveWikiLink } from '../lib/wiki-link-resolver';
import { type PropType, PROP_TYPES, TYPE_ICONS, TAG_COLORS } from './properties-types';
import { convertValue, parseListValue } from './properties-helpers';

type Props = { key: string; value: string; type: PropType }[];
type CommitFn = (view: EditorView, props: Props) => void;
type ToPropsFn = () => Props;

// ── Type dropdown ───────────────────────────────────────────

export function showTypeDropdown(
  view: EditorView,
  anchor: HTMLElement,
  props: Props,
  index: number,
  toProps: ToPropsFn,
  commit: CommitFn,
) {
  document.querySelectorAll('.cm-props-type-dropdown').forEach((el) => el.remove());

  const dropdown = document.createElement('div');
  dropdown.className = 'cm-props-type-dropdown';
  Object.assign(dropdown.style, {
    position: 'fixed',
    backgroundColor: 'var(--ctp-mantle)',
    border: '1px solid var(--ctp-surface2)',
    borderRadius: '8px',
    padding: '4px',
    zIndex: '9999',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(69,71,90,0.3)',
    minWidth: '150px',
  });

  for (const { type, label } of PROP_TYPES) {
    const isActive = type === props[index].type;
    const item = document.createElement('button');
    Object.assign(item.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
      padding: '6px 10px',
      border: 'none',
      borderRadius: '4px',
      backgroundColor: isActive ? 'var(--ctp-surface1)' : 'transparent',
      color: isActive ? 'var(--ctp-accent)' : 'var(--ctp-text)',
      fontSize: '12px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      textAlign: 'left' as const,
    });

    item.addEventListener('mouseenter', () => {
      if (!isActive) item.style.backgroundColor = 'var(--ctp-surface0)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = isActive ? 'var(--ctp-surface1)' : 'transparent';
    });

    const iconSpan = document.createElement('span');
    Object.assign(iconSpan.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '18px',
      height: '18px',
      color: isActive ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)',
    });
    iconSpan.innerHTML = TYPE_ICONS[type];
    item.appendChild(iconSpan);

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    item.appendChild(labelSpan);

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.remove();
      if (type !== props[index].type) {
        const updated = toProps();
        const old = updated[index];
        updated[index] = {
          key: old.key,
          value: convertValue(old.value, old.type, type),
          type,
        };
        commit(view, updated);
      }
    });

    dropdown.appendChild(item);
  }

  const rect = anchor.getBoundingClientRect();
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom + 4}px`;
  document.body.appendChild(dropdown);

  const closeHandler = (e: MouseEvent) => {
    if (!dropdown.contains(e.target as Node)) {
      dropdown.remove();
      document.removeEventListener('mousedown', closeHandler, true);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', closeHandler, true), 0);
}

// ── Value builders ──────────────────────────────────────────

function renderValueWithLinks(value: string, container: HTMLElement) {
  const LINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  const span = document.createElement('span');
  span.className = 'cm-props-val-text';

  while ((match = LINK_RE.exec(value)) !== null) {
    if (match.index > lastIdx) {
      span.appendChild(document.createTextNode(value.slice(lastIdx, match.index)));
    }
    const target = match[1];
    const display = match[2] ?? target;
    const link = document.createElement('a');
    link.className = 'cm-props-link';
    link.textContent = display;
    link.title = target;
    link.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const vaultPath = useVaultStore.getState().vaultPath;
      const flatFiles = useVaultStore.getState().flatFiles;
      if (!vaultPath) return;
      const resolved = resolveWikiLink(target, flatFiles);
      if (resolved) {
        useEditorStore.getState().openFile(vaultPath, resolved, e.ctrlKey || e.metaKey);
      }
    });
    span.appendChild(link);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < value.length) {
    span.appendChild(document.createTextNode(value.slice(lastIdx)));
  }
  container.appendChild(span);
}

export function buildText(
  view: EditorView,
  props: Props,
  index: number,
  editable: boolean,
  container: HTMLElement,
  toProps: ToPropsFn,
  commit: CommitFn,
) {
  if (editable) {
    const input = document.createElement('input');
    input.className = 'cm-props-val-input';
    input.type = 'text';
    input.value = props[index].value;
    input.placeholder = 'Empty';
    input.addEventListener('blur', () => {
      if (input.value !== props[index].value) {
        const updated = toProps();
        updated[index] = { ...updated[index], value: input.value };
        commit(view, updated);
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
    container.appendChild(input);
  } else {
    const value = props[index].value;
    if (value) {
      renderValueWithLinks(value, container);
    } else {
      const span = document.createElement('span');
      span.className = 'cm-props-val-text cm-props-empty';
      span.textContent = 'Empty';
      container.appendChild(span);
    }
  }
}

export function buildNumber(
  view: EditorView,
  props: Props,
  index: number,
  editable: boolean,
  container: HTMLElement,
  toProps: ToPropsFn,
  commit: CommitFn,
) {
  if (editable) {
    const input = document.createElement('input');
    input.className = 'cm-props-val-input';
    input.type = 'number';
    input.value = props[index].value;
    input.addEventListener('blur', () => {
      if (input.value !== props[index].value) {
        const updated = toProps();
        updated[index] = { ...updated[index], value: input.value };
        commit(view, updated);
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
    container.appendChild(input);
  } else {
    const span = document.createElement('span');
    span.className = 'cm-props-val-text';
    span.textContent = props[index].value;
    container.appendChild(span);
  }
}

export function buildCheckbox(
  view: EditorView,
  props: Props,
  index: number,
  editable: boolean,
  container: HTMLElement,
  toProps: ToPropsFn,
  commit: CommitFn,
) {
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'cm-props-checkbox';
  cb.checked = props[index].value === 'true';
  cb.disabled = !editable;

  if (editable) {
    cb.addEventListener('change', (e) => {
      e.preventDefault();
      const updated = toProps();
      updated[index] = { ...updated[index], value: cb.checked ? 'true' : 'false' };
      commit(view, updated);
    });
  }
  container.appendChild(cb);
}

export function buildDate(
  view: EditorView,
  props: Props,
  index: number,
  editable: boolean,
  container: HTMLElement,
  toProps: ToPropsFn,
  commit: CommitFn,
) {
  if (editable) {
    const input = document.createElement('input');
    input.className = 'cm-props-val-input cm-props-date-input';
    input.type = 'date';
    input.value = props[index].value;
    input.addEventListener('change', () => {
      const updated = toProps();
      updated[index] = { ...updated[index], value: input.value };
      commit(view, updated);
    });
    container.appendChild(input);
  } else {
    const span = document.createElement('span');
    span.className = 'cm-props-val-text';
    span.textContent = props[index].value;
    container.appendChild(span);
  }
}

export function buildDatetime(
  view: EditorView,
  props: Props,
  index: number,
  editable: boolean,
  container: HTMLElement,
  toProps: ToPropsFn,
  commit: CommitFn,
) {
  if (editable) {
    const input = document.createElement('input');
    input.className = 'cm-props-val-input cm-props-date-input';
    input.type = 'datetime-local';
    input.value = props[index].value;
    input.addEventListener('change', () => {
      const updated = toProps();
      updated[index] = { ...updated[index], value: input.value };
      commit(view, updated);
    });
    container.appendChild(input);
  } else {
    const span = document.createElement('span');
    span.className = 'cm-props-val-text';
    span.textContent = props[index].value;
    container.appendChild(span);
  }
}

export function buildList(
  view: EditorView,
  props: Props,
  index: number,
  editable: boolean,
  container: HTMLElement,
  toProps: ToPropsFn,
  commit: CommitFn,
) {
  const tagsWrap = document.createElement('div');
  tagsWrap.className = 'cm-props-tags';

  const items = parseListValue(props[index].value);

  items.forEach((item, idx) => {
    const pill = document.createElement('span');
    pill.className = `cm-props-pill ${TAG_COLORS[idx % TAG_COLORS.length]}`;

    const text = document.createElement('span');
    text.textContent = item;
    pill.appendChild(text);

    if (editable) {
      const rm = document.createElement('span');
      rm.className = 'cm-props-pill-x';
      rm.textContent = '\u00d7';
      rm.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newItems = items.filter((_, i) => i !== idx);
        const updated = toProps();
        updated[index] = { ...updated[index], value: `[${newItems.join(', ')}]` };
        commit(view, updated);
      });
      pill.appendChild(rm);
    }
    tagsWrap.appendChild(pill);
  });

  if (editable) {
    const inputWrap = document.createElement('div');
    inputWrap.style.position = 'relative';
    inputWrap.style.display = 'inline-flex';

    const addInput = document.createElement('input');
    addInput.className = 'cm-props-tag-add';
    addInput.placeholder = '+';

    const isTagKey = ['tags', 'categories', 'keywords'].includes(props[index].key.toLowerCase());

    const addItem = (val: string) => {
      val = val.trim();
      if (val) {
        const newItems = [...items, val];
        const updated = toProps();
        updated[index] = { ...updated[index], value: `[${newItems.join(', ')}]` };
        commit(view, updated);
      }
    };

    let dropdown: HTMLElement | null = null;
    let selectedIdx = -1;

    const highlightItem = (idx: number) => {
      if (!dropdown) return;
      const children = dropdown.children;
      for (let i = 0; i < children.length; i++) {
        const el = children[i] as HTMLElement;
        if (i === idx) {
          el.style.backgroundColor = 'var(--ctp-surface0)';
          el.style.color = 'var(--ctp-accent)';
          el.scrollIntoView({ block: 'nearest' });
        } else {
          el.style.backgroundColor = 'transparent';
          el.style.color = 'var(--ctp-text)';
        }
      }
      selectedIdx = idx;
    };

    const closeSuggestions = () => {
      if (dropdown) { dropdown.remove(); dropdown = null; }
      selectedIdx = -1;
    };

    const showSuggestions = () => {
      closeSuggestions();
      if (!isTagKey) return;
      const query = addInput.value.trim().toLowerCase();
      const tagIndex = useVaultStore.getState().tagIndex;
      const existing = new Set(items.map(i => i.toLowerCase()));
      const matches: string[] = [];
      for (const tag of tagIndex.keys()) {
        if (!existing.has(tag.toLowerCase()) && (!query || tag.toLowerCase().includes(query))) {
          matches.push(tag);
        }
        if (matches.length >= 8) break;
      }
      if (matches.length === 0) return;

      dropdown = document.createElement('div');
      const rect = addInput.getBoundingClientRect();
      Object.assign(dropdown.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.bottom + 2}px`,
        minWidth: `${Math.max(rect.width, 120)}px`,
        maxHeight: '180px',
        overflowY: 'auto',
        zIndex: '9999',
        backgroundColor: 'var(--ctp-mantle)',
        border: '1px solid var(--ctp-surface2)',
        borderRadius: '6px',
        padding: '3px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
      });

      for (const tag of matches) {
        const item = document.createElement('button');
        Object.assign(item.style, {
          display: 'block',
          width: '100%',
          padding: '4px 10px',
          border: 'none',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          color: 'var(--ctp-text)',
          fontSize: '0.85em',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        });
        item.textContent = tag;
        item.addEventListener('mouseenter', () => {
          item.style.backgroundColor = 'var(--ctp-surface0)';
          item.style.color = 'var(--ctp-accent)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.backgroundColor = 'transparent';
          item.style.color = 'var(--ctp-text)';
        });
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeSuggestions();
          addItem(tag);
        });
        dropdown.appendChild(item);
      }
      document.body.appendChild(dropdown);
    };

    addInput.addEventListener('input', showSuggestions);
    addInput.addEventListener('focus', showSuggestions);
    addInput.addEventListener('blur', () => {
      setTimeout(closeSuggestions, 150);
    });
    addInput.addEventListener('keydown', (e) => {
      if (dropdown && dropdown.children.length > 0) {
        const count = dropdown.children.length;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          highlightItem(selectedIdx < count - 1 ? selectedIdx + 1 : 0);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlightItem(selectedIdx > 0 ? selectedIdx - 1 : count - 1);
          return;
        }
        if (e.key === 'Enter' && selectedIdx >= 0) {
          e.preventDefault();
          const tag = (dropdown.children[selectedIdx] as HTMLElement).textContent ?? '';
          closeSuggestions();
          addItem(tag);
          return;
        }
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        closeSuggestions();
        addItem(addInput.value);
      }
      if (e.key === 'Escape') closeSuggestions();
    });

    inputWrap.appendChild(addInput);
    tagsWrap.appendChild(inputWrap);
  }

  container.appendChild(tagsWrap);
}

// ── Row builder ─────────────────────────────────────────────

export function buildRow(
  view: EditorView,
  props: Props,
  index: number,
  editable: boolean,
  toProps: ToPropsFn,
  commit: CommitFn,
): HTMLElement {
  const { key, type } = props[index];
  const showTypes = useSettingsStore.getState().propertiesShowTypes;

  const row = document.createElement('div');
  row.className = 'cm-props-row';

  if (showTypes) {
    const typeBtn = document.createElement('button');
    typeBtn.className = 'cm-props-type-btn';
    typeBtn.innerHTML = TYPE_ICONS[type];
    typeBtn.title = PROP_TYPES.find((t) => t.type === type)?.label ?? type;

    if (editable) {
      typeBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showTypeDropdown(view, typeBtn, props, index, toProps, commit);
      });
    }
    row.appendChild(typeBtn);
  }

  if (editable) {
    const keyInput = document.createElement('input');
    keyInput.className = 'cm-props-key';
    keyInput.value = key;
    keyInput.placeholder = 'key';
    keyInput.addEventListener('blur', () => {
      if (keyInput.value !== key) {
        const updated = toProps();
        updated[index] = { ...updated[index], key: keyInput.value };
        commit(view, updated);
      }
    });
    keyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') keyInput.blur();
    });
    row.appendChild(keyInput);
  } else {
    const keySpan = document.createElement('span');
    keySpan.className = 'cm-props-key cm-props-key-ro';
    keySpan.textContent = key;
    row.appendChild(keySpan);
  }

  const sep = document.createElement('span');
  sep.className = 'cm-props-sep';
  row.appendChild(sep);

  const valContainer = document.createElement('div');
  valContainer.className = 'cm-props-val';

  switch (type) {
    case 'checkbox':
      buildCheckbox(view, props, index, editable, valContainer, toProps, commit);
      break;
    case 'list':
      buildList(view, props, index, editable, valContainer, toProps, commit);
      break;
    case 'date':
      buildDate(view, props, index, editable, valContainer, toProps, commit);
      break;
    case 'datetime':
      buildDatetime(view, props, index, editable, valContainer, toProps, commit);
      break;
    case 'number':
      buildNumber(view, props, index, editable, valContainer, toProps, commit);
      break;
    default:
      buildText(view, props, index, editable, valContainer, toProps, commit);
  }

  row.appendChild(valContainer);

  if (editable) {
    const del = document.createElement('button');
    del.className = 'cm-props-delete';
    del.textContent = '\u00D7';
    del.title = 'Remove property';
    del.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const updated = toProps();
      updated.splice(index, 1);
      commit(view, updated);
    });
    row.appendChild(del);
  }

  return row;
}
