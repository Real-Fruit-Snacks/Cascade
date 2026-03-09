import { WidgetType, EditorView } from '@codemirror/view';
import { useVaultStore } from '../stores/vault-store';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';
import { resolveWikiLink } from '../lib/wiki-link-resolver';

// ── Property types (matching Obsidian) ──────────────────────

type PropType = 'text' | 'list' | 'number' | 'checkbox' | 'date' | 'datetime';

const PROP_TYPES: { type: PropType; label: string; icon: string }[] = [
  { type: 'text', label: 'Text', icon: 'T' },
  { type: 'list', label: 'List', icon: '\u2261' },
  { type: 'number', label: 'Number', icon: '#' },
  { type: 'checkbox', label: 'Checkbox', icon: '\u2713' },
  { type: 'date', label: 'Date', icon: '\u25A3' },
  { type: 'datetime', label: 'Date & time', icon: '\u25A3' },
];

function detectType(key: string, value: string): PropType {
  if (value === 'true' || value === 'false') return 'checkbox';
  const k = key.toLowerCase();
  if (/^\[/.test(value) || k === 'tags' || k === 'categories' || k === 'keywords' || k === 'aliases') return 'list';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'datetime';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
  if (/^-?\d+(\.\d+)?$/.test(value) && value !== '') return 'number';
  return 'text';
}

function convertValue(oldValue: string, oldType: PropType, newType: PropType): string {
  if (oldType === newType) return oldValue;
  switch (newType) {
    case 'text': {
      if (oldType === 'list') {
        const items = parseListValue(oldValue);
        return items.join(', ');
      }
      return oldValue;
    }
    case 'list': {
      if (oldValue && !oldValue.startsWith('[')) return `[${oldValue}]`;
      if (!oldValue) return '[]';
      return oldValue;
    }
    case 'number': {
      const n = parseFloat(oldValue);
      return isNaN(n) ? '0' : String(n);
    }
    case 'checkbox':
      return oldValue === 'true' ? 'true' : 'false';
    case 'date': {
      if (/^\d{4}-\d{2}-\d{2}/.test(oldValue)) return oldValue.slice(0, 10);
      return new Date().toISOString().slice(0, 10);
    }
    case 'datetime': {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(oldValue)) return oldValue.slice(0, 16);
      if (/^\d{4}-\d{2}-\d{2}$/.test(oldValue)) return `${oldValue}T00:00`;
      return new Date().toISOString().slice(0, 16);
    }
    default:
      return oldValue;
  }
}

function parseListValue(value: string): string[] {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
  }
  return value ? [value] : [];
}

// ── YAML serialization ──────────────────────────────────────

function serializeYaml(props: { key: string; value: string; type: PropType }[]): string {
  let yaml = '---\n';
  for (const { key, value, type } of props) {
    if (!key) continue;
    if (type === 'list') {
      const items = parseListValue(value);
      if (items.length === 0) {
        yaml += `${key}: []\n`;
      } else {
        yaml += `${key}:\n`;
        for (const item of items) {
          yaml += `  - ${item}\n`;
        }
      }
    } else {
      yaml += `${key}: ${value}\n`;
    }
  }
  yaml += '---';
  return yaml;
}

// ── SVG icons ───────────────────────────────────────────────

const TYPE_ICONS: Record<PropType, string> = {
  text: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>',
  list: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  number: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
  checkbox: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 11 12 14 22 4" stroke-width="2"/></svg>',
  date: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  datetime: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="16" cy="16" r="2"/></svg>',
};

const TAG_COLORS = ['mauve', 'blue', 'teal', 'green', 'peach', 'pink'];

// Track whether we should auto-focus the last key input after widget recreation
let _focusNewKey = false;

// ── Widget ──────────────────────────────────────────────────

export class PropertiesWidget extends WidgetType {
  constructor(
    readonly properties: [string, string][],
    readonly fmFrom: number,
    readonly fmTo: number,
  ) {
    super();
  }

  eq(other: PropertiesWidget) {
    return this.fmFrom === other.fmFrom && this.fmTo === other.fmTo &&
           this.properties.length === other.properties.length &&
           this.properties.every(([k, v], i) => other.properties[i][0] === k && other.properties[i][1] === v);
  }

  private toProps(): { key: string; value: string; type: PropType }[] {
    return this.properties.map(([k, v]) => ({ key: k, value: v, type: detectType(k, v) }));
  }

  private commit(view: EditorView, props: { key: string; value: string; type: PropType }[]) {
    const yaml = serializeYaml(props);
    view.dispatch({
      changes: { from: this.fmFrom, to: this.fmTo, insert: yaml },
    });
  }

  toDOM(view: EditorView): HTMLElement {
    const editable = view.state.facet(EditorView.editable);
    const props = this.toProps();

    const wrapper = document.createElement('div');
    wrapper.className = 'cm-properties-editor';

    // Header
    const header = document.createElement('div');
    header.className = 'cm-props-header';
    const headerIcon = document.createElement('span');
    headerIcon.className = 'cm-props-header-icon';
    headerIcon.textContent = '\u2699';
    header.appendChild(headerIcon);
    const headerText = document.createElement('span');
    headerText.textContent = 'Properties';
    header.appendChild(headerText);
    const count = document.createElement('span');
    count.className = 'cm-props-count';
    count.textContent = String(props.length);
    header.appendChild(count);
    wrapper.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'cm-props-body';
    for (let i = 0; i < props.length; i++) {
      body.appendChild(this.buildRow(view, props, i, editable));
    }
    wrapper.appendChild(body);

    // Add property button
    if (editable) {
      const addBtn = document.createElement('button');
      addBtn.className = 'cm-props-add';
      addBtn.textContent = '+ Add property';
      addBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const updated = this.toProps();
        let newKey = 'property';
        let n = 1;
        while (updated.some((p) => p.key === newKey)) {
          newKey = `property${n++}`;
        }
        updated.push({ key: newKey, value: '', type: 'text' });
        _focusNewKey = true;
        this.commit(view, updated);
      });
      wrapper.appendChild(addBtn);
    }

    // Auto-focus and select the last key input when a new property was added
    if (_focusNewKey) {
      _focusNewKey = false;
      requestAnimationFrame(() => {
        const inputs = wrapper.querySelectorAll('input.cm-props-key');
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement | null;
        if (lastInput) {
          lastInput.focus();
          lastInput.select();
        }
      });
    }

    return wrapper;
  }

  private buildRow(
    view: EditorView,
    props: { key: string; value: string; type: PropType }[],
    index: number,
    editable: boolean,
  ): HTMLElement {
    const { key, type } = props[index];
    const showTypes = useSettingsStore.getState().propertiesShowTypes;

    const row = document.createElement('div');
    row.className = 'cm-props-row';

    // Type icon button (clickable for type dropdown)
    if (showTypes) {
      const typeBtn = document.createElement('button');
      typeBtn.className = 'cm-props-type-btn';
      typeBtn.innerHTML = TYPE_ICONS[type];
      typeBtn.title = PROP_TYPES.find((t) => t.type === type)?.label ?? type;

      if (editable) {
        typeBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showTypeDropdown(view, typeBtn, props, index);
        });
      }
      row.appendChild(typeBtn);
    }

    // Key
    if (editable) {
      const keyInput = document.createElement('input');
      keyInput.className = 'cm-props-key';
      keyInput.value = key;
      keyInput.placeholder = 'key';
      keyInput.addEventListener('blur', () => {
        if (keyInput.value !== key) {
          const updated = this.toProps();
          updated[index] = { ...updated[index], key: keyInput.value };
          this.commit(view, updated);
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

    // Separator
    const sep = document.createElement('span');
    sep.className = 'cm-props-sep';
    row.appendChild(sep);

    // Value
    const valContainer = document.createElement('div');
    valContainer.className = 'cm-props-val';

    switch (type) {
      case 'checkbox':
        this.buildCheckbox(view, props, index, editable, valContainer);
        break;
      case 'list':
        this.buildList(view, props, index, editable, valContainer);
        break;
      case 'date':
        this.buildDate(view, props, index, editable, valContainer);
        break;
      case 'datetime':
        this.buildDatetime(view, props, index, editable, valContainer);
        break;
      case 'number':
        this.buildNumber(view, props, index, editable, valContainer);
        break;
      default:
        this.buildText(view, props, index, editable, valContainer);
    }

    row.appendChild(valContainer);

    // Delete button
    if (editable) {
      const del = document.createElement('button');
      del.className = 'cm-props-delete';
      del.textContent = '\u00D7';
      del.title = 'Remove property';
      del.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const updated = this.toProps();
        updated.splice(index, 1);
        this.commit(view, updated);
      });
      row.appendChild(del);
    }

    return row;
  }

  // ── Type dropdown ───────────────────────────────────────────

  private showTypeDropdown(
    view: EditorView,
    anchor: HTMLElement,
    props: { key: string; value: string; type: PropType }[],
    index: number,
  ) {
    // Remove any existing dropdown
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
          const updated = this.toProps();
          const old = updated[index];
          updated[index] = {
            key: old.key,
            value: convertValue(old.value, old.type, type),
            type,
          };
          this.commit(view, updated);
        }
      });

      dropdown.appendChild(item);
    }

    // Position dropdown below the anchor
    const rect = anchor.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom + 4}px`;
    document.body.appendChild(dropdown);

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.remove();
        document.removeEventListener('mousedown', closeHandler, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler, true), 0);
  }

  // ── Value builders ──────────────────────────────────────────

  private buildText(
    view: EditorView,
    props: { key: string; value: string; type: PropType }[],
    index: number,
    editable: boolean,
    container: HTMLElement,
  ) {
    if (editable) {
      const input = document.createElement('input');
      input.className = 'cm-props-val-input';
      input.type = 'text';
      input.value = props[index].value;
      input.placeholder = 'Empty';
      input.addEventListener('blur', () => {
        if (input.value !== props[index].value) {
          const updated = this.toProps();
          updated[index] = { ...updated[index], value: input.value };
          this.commit(view, updated);
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
      });
      container.appendChild(input);
    } else {
      const value = props[index].value;
      if (value) {
        this.renderValueWithLinks(value, container);
      } else {
        const span = document.createElement('span');
        span.className = 'cm-props-val-text cm-props-empty';
        span.textContent = 'Empty';
        container.appendChild(span);
      }
    }
  }

  /** Render a text value, making [[wiki-links]] clickable. */
  private renderValueWithLinks(value: string, container: HTMLElement) {
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

  private buildNumber(
    view: EditorView,
    props: { key: string; value: string; type: PropType }[],
    index: number,
    editable: boolean,
    container: HTMLElement,
  ) {
    if (editable) {
      const input = document.createElement('input');
      input.className = 'cm-props-val-input';
      input.type = 'number';
      input.value = props[index].value;
      input.addEventListener('blur', () => {
        if (input.value !== props[index].value) {
          const updated = this.toProps();
          updated[index] = { ...updated[index], value: input.value };
          this.commit(view, updated);
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

  private buildCheckbox(
    view: EditorView,
    props: { key: string; value: string; type: PropType }[],
    index: number,
    editable: boolean,
    container: HTMLElement,
  ) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'cm-props-checkbox';
    cb.checked = props[index].value === 'true';
    cb.disabled = !editable;

    if (editable) {
      cb.addEventListener('change', (e) => {
        e.preventDefault();
        const updated = this.toProps();
        updated[index] = { ...updated[index], value: cb.checked ? 'true' : 'false' };
        this.commit(view, updated);
      });
    }
    container.appendChild(cb);
  }

  private buildDate(
    view: EditorView,
    props: { key: string; value: string; type: PropType }[],
    index: number,
    editable: boolean,
    container: HTMLElement,
  ) {
    if (editable) {
      const input = document.createElement('input');
      input.className = 'cm-props-val-input cm-props-date-input';
      input.type = 'date';
      input.value = props[index].value;
      input.addEventListener('change', () => {
        const updated = this.toProps();
        updated[index] = { ...updated[index], value: input.value };
        this.commit(view, updated);
      });
      container.appendChild(input);
    } else {
      const span = document.createElement('span');
      span.className = 'cm-props-val-text';
      span.textContent = props[index].value;
      container.appendChild(span);
    }
  }

  private buildDatetime(
    view: EditorView,
    props: { key: string; value: string; type: PropType }[],
    index: number,
    editable: boolean,
    container: HTMLElement,
  ) {
    if (editable) {
      const input = document.createElement('input');
      input.className = 'cm-props-val-input cm-props-date-input';
      input.type = 'datetime-local';
      input.value = props[index].value;
      input.addEventListener('change', () => {
        const updated = this.toProps();
        updated[index] = { ...updated[index], value: input.value };
        this.commit(view, updated);
      });
      container.appendChild(input);
    } else {
      const span = document.createElement('span');
      span.className = 'cm-props-val-text';
      span.textContent = props[index].value;
      container.appendChild(span);
    }
  }

  private buildList(
    view: EditorView,
    props: { key: string; value: string; type: PropType }[],
    index: number,
    editable: boolean,
    container: HTMLElement,
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
          const updated = this.toProps();
          updated[index] = { ...updated[index], value: `[${newItems.join(', ')}]` };
          this.commit(view, updated);
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
          const updated = this.toProps();
          updated[index] = { ...updated[index], value: `[${newItems.join(', ')}]` };
          this.commit(view, updated);
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

  ignoreEvent(): boolean {
    return true;
  }
}

// ── Theme ───────────────────────────────────────────────────

export const propertiesTheme = EditorView.theme({
  '.cm-properties-editor': {
    display: 'block',
    backgroundColor: 'var(--ctp-mantle)',
    border: '1px solid var(--ctp-surface1)',
    borderRadius: '10px',
    paddingBottom: '0',
    fontSize: '0.85em',
    overflow: 'hidden',
    marginBottom: '12px',
    borderBottom: '2px solid var(--ctp-surface1)',
  },
  '.cm-props-header': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderBottom: '1px solid var(--ctp-surface1)',
    color: 'var(--ctp-overlay1)',
    fontSize: '0.8em',
    fontWeight: '600',
    letterSpacing: '0.03em',
  },
  '.cm-props-header-icon': {
    fontSize: '11px',
    color: 'var(--ctp-overlay0)',
    transition: 'color 150ms',
  },
  '.cm-props-header:hover .cm-props-header-icon': {
    color: 'var(--ctp-accent)',
  },
  '.cm-props-count': {
    marginLeft: 'auto',
    color: 'var(--ctp-overlay0)',
    fontSize: '0.85em',
  },
  '.cm-props-row': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px 4px 6px',
    borderBottom: '1px solid rgba(69,71,90,0.3)',
    transition: 'background-color 100ms',
    minHeight: '32px',
  },
  '.cm-props-row:last-child': {
    borderBottom: 'none',
  },
  '.cm-props-row:hover': {
    backgroundColor: 'rgba(49,50,68,0.4)',
  },
  '.cm-props-row:hover .cm-props-delete': {
    opacity: '1',
  },
  // Type button
  '.cm-props-type-btn': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: 'var(--ctp-overlay1)',
    border: 'none',
    cursor: 'pointer',
    flexShrink: '0',
    transition: 'color 100ms',
    padding: '0',
  },
  '.cm-props-type-btn:hover': {
    color: 'var(--ctp-accent)',
  },
  // Type dropdown uses inline styles (appended to document.body, outside .cm-editor scope)
  // Key
  'input.cm-props-key': {
    color: 'var(--ctp-subtext0)',
    fontSize: '0.9em',
    width: '90px',
    flexShrink: '0',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    padding: '2px 4px',
    borderRadius: '3px',
  },
  'input.cm-props-key:focus': {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
  },
  '.cm-props-key-ro': {
    color: 'var(--ctp-subtext0)',
    fontSize: '0.9em',
    width: '90px',
    flexShrink: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Separator
  '.cm-props-sep': {
    width: '1px',
    height: '16px',
    backgroundColor: 'var(--ctp-surface1)',
    flexShrink: '0',
  },
  // Value container
  '.cm-props-val': {
    flex: '1',
    minWidth: '0',
    display: 'flex',
    alignItems: 'center',
  },
  '.cm-props-val-input': {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--ctp-text)',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  '.cm-props-val-input:focus': {
    backgroundColor: 'var(--ctp-surface0)',
  },
  '.cm-props-date-input': {
    colorScheme: 'dark',
  },
  '.cm-props-val-text': {
    padding: '2px 8px',
    borderRadius: '4px',
    color: 'var(--ctp-text)',
  },
  '.cm-props-empty': {
    color: 'var(--ctp-overlay0)',
    fontStyle: 'italic',
  },
  // Checkbox
  '.cm-props-checkbox': {
    width: '16px',
    height: '16px',
    accentColor: 'var(--ctp-accent)',
    cursor: 'pointer',
    margin: '0 4px',
  },
  // Tags / List
  '.cm-props-tags': {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'center',
    padding: '2px 0',
  },
  '.cm-props-pill': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '1px 10px',
    borderRadius: '12px',
    fontSize: '0.85em',
    fontWeight: '500',
  },
  '.cm-props-pill.mauve': { backgroundColor: 'rgba(203,166,247,0.15)', color: 'var(--ctp-mauve)' },
  '.cm-props-pill.blue': { backgroundColor: 'rgba(137,180,250,0.15)', color: 'var(--ctp-blue)' },
  '.cm-props-pill.teal': { backgroundColor: 'rgba(148,226,213,0.15)', color: 'var(--ctp-teal)' },
  '.cm-props-pill.green': { backgroundColor: 'rgba(166,227,161,0.15)', color: 'var(--ctp-green)' },
  '.cm-props-pill.peach': { backgroundColor: 'rgba(250,179,135,0.15)', color: 'var(--ctp-peach)' },
  '.cm-props-pill.pink': { backgroundColor: 'rgba(245,194,231,0.15)', color: 'var(--ctp-pink)' },
  '.cm-props-pill-x': {
    cursor: 'pointer',
    fontSize: '11px',
    opacity: '0.5',
    marginLeft: '2px',
  },
  '.cm-props-pill-x:hover': {
    opacity: '1',
  },
  '.cm-props-tag-add': {
    width: '40px',
    background: 'transparent',
    border: '1px dashed var(--ctp-surface2)',
    borderRadius: '12px',
    color: 'var(--ctp-overlay0)',
    fontSize: '0.85em',
    padding: '1px 8px',
    outline: 'none',
    textAlign: 'center',
    fontFamily: 'inherit',
  },
  '.cm-props-tag-add:focus': {
    borderColor: 'var(--ctp-accent)',
    width: '80px',
    color: 'var(--ctp-text)',
  },
  // Delete button
  '.cm-props-delete': {
    opacity: '0',
    background: 'transparent',
    border: 'none',
    color: 'var(--ctp-overlay0)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 4px',
    borderRadius: '3px',
    transition: 'opacity 150ms, color 150ms',
    flexShrink: '0',
  },
  '.cm-props-delete:hover': {
    color: 'var(--ctp-red)',
  },
  // Add property button
  '.cm-props-add': {
    display: 'block',
    width: '100%',
    padding: '6px 14px',
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid rgba(69,71,90,0.3)',
    color: 'var(--ctp-overlay0)',
    fontSize: '0.8em',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'color 150ms',
  },
  '.cm-props-add:hover': {
    color: 'var(--ctp-accent)',
    backgroundColor: 'rgba(49,50,68,0.3)',
  },
  '.cm-props-link': {
    color: 'var(--ctp-blue)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },
  '.cm-props-link:hover': {
    color: 'var(--ctp-accent)',
  },
});
