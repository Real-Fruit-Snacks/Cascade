import { EditorView } from '@codemirror/view';

export const livePreviewTheme = EditorView.theme({
  // Frontmatter — source editing mode
  '.cm-line.cm-frontmatter-source': {
    backgroundColor: 'rgba(203,166,247,0.06)',
  },

  // Headers
  '.cm-line.cm-heading': {
    fontWeight: 'bold',
  },
  '.cm-line.cm-heading-1': {
    fontSize: '2em',
    lineHeight: '1.4',
    color: 'var(--ctp-red)',
  },
  '.cm-line.cm-heading-2': {
    fontSize: '1.6em',
    lineHeight: '1.4',
    color: 'var(--ctp-peach)',
  },
  '.cm-line.cm-heading-3': {
    fontSize: '1.3em',
    lineHeight: '1.35',
    color: 'var(--ctp-yellow)',
  },
  '.cm-line.cm-heading-4': {
    fontSize: '1.15em',
    lineHeight: '1.35',
    color: 'var(--ctp-green)',
  },
  '.cm-line.cm-heading-5': {
    fontSize: '1.05em',
    color: 'var(--ctp-blue)',
  },
  '.cm-line.cm-heading-6': {
    fontSize: '1em',
    color: 'var(--ctp-mauve)',
  },

  // Inline
  '.cm-live-bold': {
    fontWeight: 'bold',
  },
  '.cm-live-italic': {
    fontStyle: 'italic',
  },
  '.cm-live-strikethrough': {
    textDecoration: 'line-through',
    color: 'var(--ctp-overlay1)',
  },
  '.cm-live-code': {
    backgroundColor: 'var(--ctp-surface0)',
    borderRadius: '3px',
    padding: '1px 4px',
    fontSize: '0.9em',
  },
  '.cm-live-link': {
    color: 'var(--ctp-blue)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },
  '.cm-live-image': {
    color: 'var(--ctp-teal)',
    fontStyle: 'italic',
  },
  // Tables — rendered widget
  '.cm-table-widget': {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    margin: '8px 0',
    border: '1px solid var(--ctp-surface2)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  '.cm-table-widget th': {
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-text)',
    fontWeight: '600',
    padding: '6px 12px',
    borderBottom: '2px solid var(--ctp-surface2)',
    borderRight: '1px solid var(--ctp-surface2)',
    fontSize: '0.9em',
  },
  '.cm-table-widget th:last-child': {
    borderRight: 'none',
  },
  '.cm-table-widget td': {
    padding: '5px 12px',
    borderBottom: '1px solid var(--ctp-surface1)',
    borderRight: '1px solid var(--ctp-surface1)',
    color: 'var(--ctp-subtext1)',
    fontSize: '0.9em',
  },
  '.cm-table-widget td:last-child': {
    borderRight: 'none',
  },
  '.cm-table-widget tr:last-child td': {
    borderBottom: 'none',
  },
  '.cm-table-widget tbody tr:nth-child(even)': {
    backgroundColor: 'rgba(49,50,68,0.25)',
  },
  '.cm-line.cm-table-hidden-line': {
    height: '0',
    padding: '0',
    margin: '0',
    overflow: 'hidden',
    fontSize: '0',
    lineHeight: '0',
  },
  '.cm-line.cm-frontmatter-hidden': {
    height: '0 !important',
    padding: '0 !important',
    margin: '0 !important',
    overflow: 'hidden',
    fontSize: '0',
    lineHeight: '0 !important',
    border: 'none !important',
    maxHeight: '0 !important',
    minHeight: '0 !important',
  },
  // Tables — source editing mode (cursor on table)
  '.cm-line.cm-table-source': {
    backgroundColor: 'rgba(49,50,68,0.2)',
  },

  '.cm-image-widget': {
    padding: '8px 0',
    display: 'flex',
    justifyContent: 'center',
  },
  '.cm-image-embed': {
    maxWidth: '100%',
    maxHeight: '500px',
    borderRadius: '6px',
    border: '1px solid var(--ctp-surface1)',
  },

  // Block
  '.cm-line.cm-live-blockquote': {
    borderLeft: '3px solid var(--ctp-accent)',
    paddingLeft: '12px',
    color: 'var(--ctp-subtext0)',
  },
  '.cm-line.cm-live-codeblock': {
    backgroundColor: 'var(--ctp-mantle)',
    paddingLeft: '16px',
    paddingRight: '16px',
  },
  '.cm-line.cm-codeblock-first': {
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
    paddingTop: '8px',
  },
  '.cm-line.cm-codeblock-last': {
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
    paddingBottom: '8px',
  },
  '.cm-line.cm-codeblock-numbered': {
    paddingLeft: '44px',
  },
  '.cm-codeblock-line-number': {
    display: 'inline-block',
    width: '32px',
    marginLeft: '-38px',
    marginRight: '4px',
    paddingRight: '8px',
    borderRight: '1px solid var(--ctp-surface1)',
    textAlign: 'right',
    color: 'var(--ctp-overlay0)',
    fontSize: '0.8em',
    opacity: '0.6',
    userSelect: 'none',
    pointerEvents: 'none',
  },

  // Copy button anchor (first code line)
  '.cm-line.cm-codeblock-copy-line': {
    position: 'relative',
  },
  // Copy button (top-right of code block, shown on hover)
  '.cm-copy-button': {
    position: 'absolute',
    right: '8px',
    top: '2px',
    padding: '2px 8px',
    fontSize: '11px',
    fontFamily: 'inherit',
    border: '1px solid var(--ctp-surface2)',
    borderRadius: '4px',
    backgroundColor: 'var(--ctp-surface0)',
    color: 'var(--ctp-subtext0)',
    cursor: 'pointer',
    opacity: '0',
    transition: 'opacity 150ms',
    zIndex: '10',
  },
  '.cm-line.cm-codeblock-copy-line:hover .cm-copy-button': {
    opacity: '1',
  },
  '.cm-copy-button:hover': {
    backgroundColor: 'var(--ctp-surface1)',
    color: 'var(--ctp-text)',
  },

  // Embed transclusions
  '.cm-transclusion-widget': {
    display: 'block',
    margin: '2px 0',
    borderLeft: '2px solid var(--ctp-surface2)',
    paddingLeft: '2px',
    overflow: 'hidden',
  },
  '.cm-transclusion-header': {
    padding: '2px 8px',
    fontSize: '0.7em',
    fontWeight: '500',
    color: 'var(--ctp-overlay0)',
    userSelect: 'none',
    letterSpacing: '0.02em',
  },
  '.cm-transclusion-body': {
    padding: '0 4px 4px',
    fontSize: '1em',
    color: 'var(--ctp-text)',
    whiteSpace: 'normal',
    fontFamily: 'inherit',
    lineHeight: '1.6',
  },
  '.cm-transclusion-error': {
    color: 'var(--ctp-red)',
    fontStyle: 'italic',
  },
  '.cm-embed-broken': {
    color: 'var(--ctp-red)',
    textDecoration: 'underline dashed',
    textUnderlineOffset: '2px',
  },
  '.cm-embed-source': {
    color: 'var(--ctp-mauve)',
    opacity: '0.8',
  },

  // Widgets
  '.cm-hr-widget': {
    border: 'none',
    borderTop: '1px solid var(--ctp-surface2)',
    padding: '8px 0 0 0',
  },
  '.cm-checkbox-widget': {
    verticalAlign: 'middle',
    margin: '0 4px 0 0',
    accentColor: 'var(--ctp-accent)',
  },

  // ── Callouts (full colored box) ──
  '.cm-line.cm-callout': {
    borderLeft: '3px solid var(--ctp-blue)',
    paddingLeft: '16px',
    paddingRight: '16px',
    backgroundColor: 'rgba(137, 180, 250, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-first': {
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
    paddingTop: '6px',
  },
  '.cm-line.cm-callout.cm-callout-last': {
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
    paddingBottom: '6px',
  },
  // Color variants
  '.cm-line.cm-callout.cm-callout-blue': {
    borderLeftColor: 'var(--ctp-blue)',
    backgroundColor: 'rgba(137, 180, 250, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-teal': {
    borderLeftColor: 'var(--ctp-teal)',
    backgroundColor: 'rgba(148, 226, 213, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-green': {
    borderLeftColor: 'var(--ctp-green)',
    backgroundColor: 'rgba(166, 227, 161, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-yellow': {
    borderLeftColor: 'var(--ctp-yellow)',
    backgroundColor: 'rgba(249, 226, 175, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-peach': {
    borderLeftColor: 'var(--ctp-peach)',
    backgroundColor: 'rgba(250, 179, 135, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-red': {
    borderLeftColor: 'var(--ctp-red)',
    backgroundColor: 'rgba(243, 139, 168, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-mauve': {
    borderLeftColor: 'var(--ctp-mauve)',
    backgroundColor: 'rgba(203, 166, 247, 0.10)',
  },
  '.cm-line.cm-callout.cm-callout-overlay1': {
    borderLeftColor: 'var(--ctp-overlay1)',
    backgroundColor: 'rgba(147, 153, 178, 0.10)',
  },

  // Callout header widget
  '.cm-callout-header': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 'bold',
  },
  '.cm-callout-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '3px',
    fontSize: '12px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  '.cm-callout-title': {
    textTransform: 'capitalize',
  },
  // Header color variants (icon bg + title color)
  '.cm-callout-header.cm-callout-blue .cm-callout-icon': { backgroundColor: 'rgba(137, 180, 250, 0.25)', color: 'var(--ctp-blue)' },
  '.cm-callout-header.cm-callout-blue .cm-callout-title': { color: 'var(--ctp-blue)' },
  '.cm-callout-header.cm-callout-teal .cm-callout-icon': { backgroundColor: 'rgba(148, 226, 213, 0.25)', color: 'var(--ctp-teal)' },
  '.cm-callout-header.cm-callout-teal .cm-callout-title': { color: 'var(--ctp-teal)' },
  '.cm-callout-header.cm-callout-green .cm-callout-icon': { backgroundColor: 'rgba(166, 227, 161, 0.25)', color: 'var(--ctp-green)' },
  '.cm-callout-header.cm-callout-green .cm-callout-title': { color: 'var(--ctp-green)' },
  '.cm-callout-header.cm-callout-yellow .cm-callout-icon': { backgroundColor: 'rgba(249, 226, 175, 0.25)', color: 'var(--ctp-yellow)' },
  '.cm-callout-header.cm-callout-yellow .cm-callout-title': { color: 'var(--ctp-yellow)' },
  '.cm-callout-header.cm-callout-peach .cm-callout-icon': { backgroundColor: 'rgba(250, 179, 135, 0.25)', color: 'var(--ctp-peach)' },
  '.cm-callout-header.cm-callout-peach .cm-callout-title': { color: 'var(--ctp-peach)' },
  '.cm-callout-header.cm-callout-red .cm-callout-icon': { backgroundColor: 'rgba(243, 139, 168, 0.25)', color: 'var(--ctp-red)' },
  '.cm-callout-header.cm-callout-red .cm-callout-title': { color: 'var(--ctp-red)' },
  '.cm-callout-header.cm-callout-mauve .cm-callout-icon': { backgroundColor: 'rgba(203, 166, 247, 0.25)', color: 'var(--ctp-mauve)' },
  '.cm-callout-header.cm-callout-mauve .cm-callout-title': { color: 'var(--ctp-mauve)' },
  '.cm-callout-header.cm-callout-overlay1 .cm-callout-icon': { backgroundColor: 'rgba(147, 153, 178, 0.25)', color: 'var(--ctp-overlay1)' },
  '.cm-callout-header.cm-callout-overlay1 .cm-callout-title': { color: 'var(--ctp-overlay1)' },
});
