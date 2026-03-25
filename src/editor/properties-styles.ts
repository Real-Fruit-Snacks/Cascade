import { EditorView } from '@codemirror/view';

// ── Theme ────────────────────────────────────────────────────

export const propertiesTheme = EditorView.theme({
  '.cm-properties-editor': {
    display: 'block',
    backgroundColor: 'var(--ctp-mantle)',
    border: '1px solid var(--ctp-surface1)',
    borderRadius: '10px',
    fontSize: '0.85em',
    overflow: 'hidden',
    paddingBottom: '12px',
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
    borderBottom: '1px solid color-mix(in srgb, var(--ctp-overlay0) 30%, transparent)',
    transition: 'background-color 100ms',
    minHeight: '32px',
  },
  '.cm-props-row:last-child': {
    borderBottom: 'none',
  },
  '.cm-props-row:hover': {
    backgroundColor: 'color-mix(in srgb, var(--ctp-surface0) 40%, transparent)',
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
