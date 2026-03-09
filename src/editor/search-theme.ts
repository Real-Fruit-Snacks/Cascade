import { EditorView } from '@codemirror/view';

export const searchTheme = EditorView.theme({
  // Panel wrappers
  '& .cm-panels': {
    backgroundColor: 'var(--ctp-mantle)',
    color: 'var(--ctp-text)',
    fontFamily: '"Inter", sans-serif',
    zIndex: 10,
  },
  '& .cm-panels.cm-panels-top': {
    borderBottom: '1px solid var(--ctp-surface1)',
  },
  '& .cm-panel': {
    backgroundColor: 'var(--ctp-mantle)',
    color: 'var(--ctp-text)',
  },

  // Search panel
  '& .cm-panel.cm-search': {
    backgroundColor: 'var(--ctp-mantle)',
    padding: '8px 12px',
    fontFamily: '"Inter", sans-serif',
    fontSize: '12px',
    color: 'var(--ctp-text)',
  },
  // Hide the br line breaks CM6 uses for layout
  '& .cm-panel.cm-search br': {
    content: '""',
    display: 'block',
    marginTop: '4px',
  },

  // Text inputs
  '& .cm-panel.cm-search input[type="text"]': {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface1)',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    outline: 'none',
    lineHeight: '1.4',
    boxShadow: 'none',
  },
  '& .cm-panel.cm-search .cm-textfield': {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface1)',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    outline: 'none',
    lineHeight: '1.4',
    boxShadow: 'none',
  },
  '& .cm-panel.cm-search input[type="text"]:focus': {
    borderColor: 'var(--ctp-accent)',
    boxShadow: '0 0 0 1px rgba(203, 166, 247, 0.3)',
  },
  '& .cm-panel.cm-search .cm-textfield:focus': {
    borderColor: 'var(--ctp-accent)',
    boxShadow: '0 0 0 1px rgba(203, 166, 247, 0.3)',
  },
  '& .cm-panel.cm-search input::placeholder': {
    color: 'var(--ctp-overlay0)',
  },

  // Buttons
  '& .cm-panel.cm-search button': {
    background: 'var(--ctp-surface0)',
    color: 'var(--ctp-subtext1)',
    border: '1px solid var(--ctp-surface1)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    lineHeight: '1.4',
    cursor: 'pointer',
    fontFamily: '"Inter", sans-serif',
    boxShadow: 'none',
    transition: 'background-color 150ms, color 150ms',
    WebkitAppearance: 'none',
    appearance: 'none',
  },
  '& .cm-panel.cm-search .cm-button': {
    background: 'var(--ctp-surface0)',
    color: 'var(--ctp-subtext1)',
    border: '1px solid var(--ctp-surface1)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    lineHeight: '1.4',
    cursor: 'pointer',
    fontFamily: '"Inter", sans-serif',
    backgroundImage: 'none',
    boxShadow: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
  },
  '& .cm-panel.cm-search button:hover': {
    background: 'var(--ctp-surface1)',
    color: 'var(--ctp-text)',
  },
  '& .cm-panel.cm-search .cm-button:hover': {
    background: 'var(--ctp-surface1)',
    color: 'var(--ctp-text)',
    backgroundImage: 'none',
  },
  '& .cm-panel.cm-search button:active': {
    background: 'var(--ctp-surface2)',
  },

  // Close button
  '& .cm-panel.cm-search button[name="close"]': {
    color: 'var(--ctp-overlay1)',
    padding: '4px 6px',
    border: 'none',
    background: 'transparent',
  },
  '& .cm-panel.cm-search button[name="close"]:hover': {
    color: 'var(--ctp-red)',
    background: 'var(--ctp-surface0)',
  },

  // Toggle labels — inactive: dashed border, dim text (looks "off")
  '& .cm-panel.cm-search label': {
    color: 'var(--ctp-overlay0)',
    fontSize: '11px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0',
    cursor: 'pointer',
    background: 'transparent',
    border: '1px dashed var(--ctp-surface2)',
    borderRadius: '4px',
    padding: '3px 8px',
    transition: 'all 150ms ease',
    userSelect: 'none',
  },
  '& .cm-panel.cm-search label:hover': {
    color: 'var(--ctp-subtext1)',
    borderColor: 'var(--ctp-overlay0)',
    background: 'var(--ctp-surface0)',
  },

  // Checkboxes — styled as small toggle indicators inside the pill
  '& .cm-panel.cm-search input[type="checkbox"]': {
    appearance: 'none',
    WebkitAppearance: 'none',
    width: '8px',
    height: '8px',
    margin: '0 5px 0 0',
    padding: '0',
    borderRadius: '50%',
    border: '1px solid var(--ctp-surface2)',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    flexShrink: '0',
  },
  '& .cm-panel.cm-search input[type="checkbox"]:checked': {
    background: 'var(--ctp-accent)',
    borderColor: 'var(--ctp-accent)',
    boxShadow: '0 0 4px color-mix(in srgb, var(--ctp-accent) 50%, transparent)',
  },

  // Active/checked label state — solid border, accent tint
  '& .cm-panel.cm-search label:has(input:checked)': {
    background: 'color-mix(in srgb, var(--ctp-accent) 12%, transparent)',
    borderColor: 'var(--ctp-accent)',
    borderStyle: 'solid',
    color: 'var(--ctp-accent)',
  },
  '& .cm-panel.cm-search label:has(input:checked):hover': {
    background: 'color-mix(in srgb, var(--ctp-accent) 20%, transparent)',
  },

  // Match highlights in the editor
  '.cm-searchMatch': {
    backgroundColor: 'rgba(203, 166, 247, 0.18)',
    borderRadius: '2px',
    outline: '1px solid rgba(203, 166, 247, 0.35)',
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'rgba(203, 166, 247, 0.35)',
    borderRadius: '2px',
    outline: '2px solid var(--ctp-accent)',
  },

  // Selection match highlights
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(137, 180, 250, 0.12)',
    borderRadius: '2px',
  },

  // Goto line panel
  '& .cm-panel.cm-gotoLine': {
    backgroundColor: 'var(--ctp-mantle)',
    padding: '8px 12px',
    fontFamily: '"Inter", sans-serif',
    fontSize: '12px',
    color: 'var(--ctp-text)',
  },
  '& .cm-panel.cm-gotoLine input': {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    border: '1px solid var(--ctp-surface1)',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    outline: 'none',
  },
  '& .cm-panel.cm-gotoLine input:focus': {
    borderColor: 'var(--ctp-accent)',
  },
  '& .cm-panel.cm-gotoLine button': {
    background: 'var(--ctp-surface0)',
    color: 'var(--ctp-subtext1)',
    border: '1px solid var(--ctp-surface1)',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  '& .cm-panel.cm-gotoLine button:hover': {
    background: 'var(--ctp-surface1)',
    color: 'var(--ctp-text)',
  },
});
