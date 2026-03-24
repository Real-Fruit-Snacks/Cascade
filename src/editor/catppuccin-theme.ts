import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';
import { flavors, isDarkTheme, isBuiltinFlavor, getCustomTheme } from '../styles/catppuccin-flavors';
import type { FlavorColors } from '../styles/catppuccin-flavors';

export function createCatppuccinTheme(dark: boolean): Extension {
  return EditorView.theme({
    '&': {
      backgroundColor: 'var(--ctp-base)',
      color: 'var(--ctp-text)',
      height: '100%',
    },
    '.cm-content': {
      caretColor: 'var(--ctp-text)',
      lineHeight: '1.6',
      paddingLeft: '40px',
      paddingRight: '40px',
      paddingBottom: '30vh',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--ctp-text)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--ctp-accent) 25%, var(--ctp-surface1))',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--ctp-mantle)',
      color: 'var(--ctp-overlay0)',
      borderRight: '1px solid var(--ctp-surface1)',
      paddingLeft: '8px',
      paddingRight: '6px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--ctp-surface0)',
    },
    '.cm-activeLine': {
      backgroundColor: dark ? 'rgba(49,50,68,0.5)' : 'rgba(172,176,190,0.3)',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'var(--ctp-surface2)',
      outline: 'none',
    },
    '.cm-scroller': {
      overscrollBehavior: 'contain',
      willChange: 'scroll-position',
    },
  }, { dark });
}

function createHighlightStyle(_c: FlavorColors): HighlightStyle {
  // Use CSS variables so colors respond to live Theme Studio changes
  return HighlightStyle.define([
    { tag: t.heading1, color: 'var(--ctp-h1)', fontWeight: 'bold' },
    { tag: t.heading2, color: 'var(--ctp-h2)', fontWeight: 'bold' },
    { tag: t.heading3, color: 'var(--ctp-h3)', fontWeight: 'bold' },
    { tag: t.heading4, color: 'var(--ctp-h4)', fontWeight: 'bold' },
    { tag: t.heading5, color: 'var(--ctp-h5)', fontWeight: 'bold' },
    { tag: t.heading6, color: 'var(--ctp-h6)', fontWeight: 'bold' },
    { tag: t.heading, color: 'var(--ctp-h6)', fontWeight: 'bold' },
    { tag: t.strong, color: 'var(--ctp-bold)', fontWeight: 'bold' },
    { tag: t.emphasis, color: 'var(--ctp-italic)', fontStyle: 'italic' },
    { tag: t.monospace, color: 'var(--ctp-code)' },
    { tag: t.special(t.string), color: 'var(--ctp-code)' },
    { tag: t.url, color: 'var(--ctp-link)' },
    { tag: t.link, color: 'var(--ctp-link)' },
    { tag: t.list, color: 'var(--ctp-list-marker)' },
    { tag: t.quote, color: 'var(--ctp-blockquote)', fontStyle: 'italic' },
    { tag: t.contentSeparator, color: 'var(--ctp-surface2)' },
    { tag: t.string, color: 'var(--ctp-code)' },
    { tag: t.keyword, color: 'var(--ctp-mauve)' },
    { tag: t.comment, color: 'var(--ctp-overlay2)', fontStyle: 'italic' },
    { tag: t.number, color: 'var(--ctp-peach)' },
    { tag: t.operator, color: 'var(--ctp-sky)' },
    { tag: t.typeName, color: 'var(--ctp-blue)' },
    { tag: t.propertyName, color: 'var(--ctp-sky)' },
    { tag: t.meta, color: 'var(--ctp-overlay2)' },
    { tag: t.punctuation, color: 'var(--ctp-text)' },
  ]);
}

export function createCatppuccinExtensions(theme: string): Extension {
  let colors: FlavorColors;
  if (isBuiltinFlavor(theme)) {
    colors = flavors[theme];
  } else {
    const custom = getCustomTheme(theme);
    colors = custom ? custom.colors : flavors.mocha;
  }
  return [
    createCatppuccinTheme(isDarkTheme(theme)),
    syntaxHighlighting(createHighlightStyle(colors)),
  ];
}
