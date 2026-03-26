import { WidgetType, EditorView } from '@codemirror/view';
import { type PropType } from './properties-types';
import { detectType, serializeYaml } from './properties-helpers';
import { buildRow } from './properties-dom';

export { propertiesTheme } from './properties-styles';

// Track whether we should auto-focus the last key input after widget recreation (per-view)
const _focusNewKeyMap = new WeakMap<EditorView, boolean>();

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

  get estimatedHeight(): number {
    // header (~31px) + rows (~33px each) + add-btn (~24px) + container chrome (~16px)
    return 31 + this.properties.length * 33 + 24 + 16;
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
    const toProps = () => this.toProps();
    const commit = (v: EditorView, p: { key: string; value: string; type: PropType }[]) =>
      this.commit(v, p);

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
      body.appendChild(buildRow(view, props, i, editable, toProps, commit));
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
        _focusNewKeyMap.set(view, true);
        this.commit(view, updated);
      });
      wrapper.appendChild(addBtn);
    }

    // Auto-focus and select the last key input when a new property was added
    if (_focusNewKeyMap.get(view)) {
      _focusNewKeyMap.set(view, false);
      requestAnimationFrame(() => {
        const inputs = wrapper.querySelectorAll('input.cm-props-key');
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement | null;
        if (lastInput) {
          lastInput.focus();
          lastInput.select();
        }
      });
    }

    // Tell CM to re-measure heights after this widget is mounted
    requestAnimationFrame(() => view.requestMeasure());

    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }
}
