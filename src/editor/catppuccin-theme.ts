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

function createHighlightStyle(c: FlavorColors): HighlightStyle {
  return HighlightStyle.define([
    { tag: t.heading1, color: c.red, fontWeight: 'bold' },
    { tag: t.heading2, color: c.peach, fontWeight: 'bold' },
    { tag: t.heading3, color: c.yellow, fontWeight: 'bold' },
    { tag: t.heading4, color: c.green, fontWeight: 'bold' },
    { tag: t.heading5, color: c.blue, fontWeight: 'bold' },
    { tag: t.heading6, color: c.mauve, fontWeight: 'bold' },
    { tag: t.heading, color: c.mauve, fontWeight: 'bold' },
    { tag: t.strong, color: c.peach, fontWeight: 'bold' },
    { tag: t.emphasis, color: c.pink, fontStyle: 'italic' },
    { tag: t.monospace, color: c.green },
    { tag: t.special(t.string), color: c.green },
    { tag: t.url, color: c.blue },
    { tag: t.link, color: c.blue },
    { tag: t.list, color: c.yellow },
    { tag: t.quote, color: c.overlay2, fontStyle: 'italic' },
    { tag: t.contentSeparator, color: c.surface2 },
    { tag: t.string, color: c.green },
    { tag: t.keyword, color: c.mauve },
    { tag: t.comment, color: c.overlay2, fontStyle: 'italic' },
    { tag: t.number, color: c.peach },
    { tag: t.operator, color: c.sky },
    { tag: t.typeName, color: c.blue },
    { tag: t.propertyName, color: c.sky },
    { tag: t.meta, color: c.overlay2 },
    { tag: t.punctuation, color: c.text },
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
