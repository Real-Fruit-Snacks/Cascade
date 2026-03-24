/**
 * build-extensions.ts
 *
 * Pure function that builds the CM6 **rendering** extensions array from settings.
 * Both the main editor (use-codemirror.ts) and canvas file cards can reuse the
 * same rendering pipeline through this shared builder.
 *
 * Rendering extensions include: live preview, wiki-links, tags, math, mermaid,
 * callouts, images, tables, syntax highlighting, indent guides, tidemark/variables,
 * footnotes, properties theme, image controls, bracket matching, line wrapping,
 * markdown language, theme, font size/family, tab size.
 *
 * Editor-specific features (save keymap, vim mode, auto-save, search, drop handler,
 * spellcheck, typewriter/focus mode, cursor line tracking, smart lists, formatting
 * keymap, code folding, line numbers, active line highlight, readable line length,
 * history, rectangular selection, crosshair cursor) are NOT included here.
 */

import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { bracketMatching } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { createCatppuccinExtensions } from './catppuccin-theme';
import { cursorLineField } from './cursor-line';
import { livePreview, livePreviewTheme, frontmatterField, markdownLinkClickHandler } from './live-preview/index';
import { highlightSyntax, highlightSyntaxTheme } from './highlight-syntax';
import type { AccentColor } from '../stores/settings-store';
import { wikiLinks, wikiLinkClickHandler, wikiLinkTheme } from './wiki-links';
import { wikiLinkCompletion } from './wiki-link-completion';
import { tags, tagTheme, tagClickHandler, tagAutocompletion } from './tags';
import { tidemarkHighlight, tidemarkTheme } from './tidemark-highlight';
import { propertiesTheme } from './properties-widget';
import { indentGuides } from './indent-guides';
import { imagePreview } from './image-preview';
import { imageControls } from './image-controls';
import { mathPreview, mathPreviewTheme } from './math-preview';
import { calloutPreview, calloutPreviewTheme } from './callout-preview';
import { tableEditor, tableEditorTheme } from './table-editor';
import { footnotePreview, footnotePreviewTheme } from './footnote-preview';
import { mermaidPreview, mermaidPreviewTheme } from './mermaid-preview';
import { queryPreview, queryPreviewTheme } from './query-preview';
import type { ViewMode } from '../types/index';

// ---------------------------------------------------------------------------
// Render compartments — the subset of compartments used for rendering
// ---------------------------------------------------------------------------

export interface RenderCompartments {
  livePreviewComp: Compartment;
  fontSizeComp: Compartment;
  fontFamilyComp: Compartment;
  lineWrappingComp: Compartment;
  themeComp: Compartment;
  tabSizeComp: Compartment;
  wikiLinksComp: Compartment;
  tagsComp: Compartment;
  tidemarkComp: Compartment;
  indentGuidesComp: Compartment;
  imagePreviewComp: Compartment;
  mathPreviewComp: Compartment;
  calloutPreviewComp: Compartment;
  mermaidPreviewComp: Compartment;
  queryPreviewComp: Compartment;
  highlightSyntaxComp: Compartment;
  markdownComp: Compartment;
  tableEditorComp: Compartment;
  readOnlyComp: Compartment;
}

export function createRenderCompartments(): RenderCompartments {
  return {
    livePreviewComp: new Compartment(),
    fontSizeComp: new Compartment(),
    fontFamilyComp: new Compartment(),
    lineWrappingComp: new Compartment(),
    themeComp: new Compartment(),
    tabSizeComp: new Compartment(),
    wikiLinksComp: new Compartment(),
    tagsComp: new Compartment(),
    tidemarkComp: new Compartment(),
    indentGuidesComp: new Compartment(),
    imagePreviewComp: new Compartment(),
    mathPreviewComp: new Compartment(),
    calloutPreviewComp: new Compartment(),
    mermaidPreviewComp: new Compartment(),
    queryPreviewComp: new Compartment(),
    highlightSyntaxComp: new Compartment(),
    markdownComp: new Compartment(),
    tableEditorComp: new Compartment(),
    readOnlyComp: new Compartment(),
  };
}

// ---------------------------------------------------------------------------
// Helpers moved from use-codemirror.ts
// ---------------------------------------------------------------------------

export function extensionsForMode(mode: ViewMode, lpEnabled = true) {
  return {
    livePreview: lpEnabled && (mode === 'live' || mode === 'reading') ? [livePreview, livePreviewTheme, frontmatterField, footnotePreview, footnotePreviewTheme] : [],
    readOnly: mode === 'reading' ? EditorView.editable.of(false) : EditorView.editable.of(true),
  };
}

export function buildHighlightSyntaxExtensions(lpEnabled: boolean, hlEnabled: boolean, color: AccentColor, mode: ViewMode) {
  const inPreviewMode = lpEnabled && (mode === 'live' || mode === 'reading');
  return inPreviewMode && hlEnabled ? [highlightSyntax, highlightSyntaxTheme(color)] : [];
}

// ---------------------------------------------------------------------------
// RenderSettings — all settings needed to build the rendering extension array
// ---------------------------------------------------------------------------

export interface RenderSettings {
  theme: string;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  enableLivePreview: boolean;
  enableHighlightSyntax: boolean;
  highlightColor: AccentColor;
  enableWikiLinks: boolean;
  enableTags: boolean;
  enableVariables: boolean;
  variablesHighlight: boolean;
  enableIndentGuides: boolean;
  indentGuideColor: AccentColor;
  indentGuideStyle: string;
  enableImagePreview: boolean;
  imagePreviewMaxHeight: number;
  enableMathPreview: boolean;
  enableCalloutPreview: boolean;
  enableMermaidPreview: boolean;
  enableQueryPreview: boolean;
}

// ---------------------------------------------------------------------------
// buildRenderExtensions — assembles all rendering extensions
// ---------------------------------------------------------------------------

export function buildRenderExtensions(
  comps: RenderCompartments,
  settings: RenderSettings,
  mode: ViewMode,
): Extension[] {
  const exts = extensionsForMode(mode, settings.enableLivePreview);

  return [
    cursorLineField,
    comps.markdownComp.of(markdown({ extensions: [GFM] })),
    comps.themeComp.of(createCatppuccinExtensions(settings.theme)),
    comps.livePreviewComp.of(exts.livePreview),
    comps.highlightSyntaxComp.of(
      buildHighlightSyntaxExtensions(settings.enableLivePreview, settings.enableHighlightSyntax, settings.highlightColor, mode),
    ),
    comps.readOnlyComp.of(exts.readOnly),
    comps.fontSizeComp.of(EditorView.theme({
      '.cm-content': { fontSize: settings.fontSize + 'px' },
      '.cm-gutters': { fontSize: settings.fontSize + 'px' },
    })),
    comps.fontFamilyComp.of(EditorView.theme({
      '.cm-content': { fontFamily: settings.fontFamily },
      '.cm-scroller': { fontFamily: settings.fontFamily },
    })),
    comps.lineWrappingComp.of(EditorView.lineWrapping),
    comps.tabSizeComp.of(EditorState.tabSize.of(settings.tabSize)),
    // In source mode, disable ALL preview decorations — show raw markdown only.
    // Wiki-links and tags keep autocompletion but disable decorations/click handlers.
    comps.wikiLinksComp.of(settings.enableWikiLinks
      ? mode === 'source' ? [wikiLinkCompletion] : [wikiLinks, wikiLinkClickHandler, wikiLinkTheme, wikiLinkCompletion]
      : []),
    comps.tagsComp.of(settings.enableTags
      ? mode === 'source' ? [tagAutocompletion] : [tags, tagTheme, tagClickHandler, tagAutocompletion]
      : []),
    comps.tidemarkComp.of(settings.enableVariables && settings.variablesHighlight && mode !== 'source' ? [tidemarkHighlight, tidemarkTheme] : []),
    comps.indentGuidesComp.of(settings.enableIndentGuides ? indentGuides(settings.indentGuideColor, settings.indentGuideStyle) : []),
    comps.imagePreviewComp.of(settings.enableImagePreview && mode !== 'source' ? imagePreview(settings.imagePreviewMaxHeight) : []),
    comps.mathPreviewComp.of(settings.enableMathPreview && mode !== 'source' ? [mathPreview, mathPreviewTheme] : []),
    comps.calloutPreviewComp.of(settings.enableCalloutPreview && mode !== 'source' ? [calloutPreview, calloutPreviewTheme] : []),
    comps.mermaidPreviewComp.of(settings.enableMermaidPreview && mode !== 'source' ? [mermaidPreview, mermaidPreviewTheme] : []),
    comps.queryPreviewComp.of(settings.enableQueryPreview && mode !== 'source' ? [queryPreview, queryPreviewTheme] : []),
    comps.tableEditorComp.of(mode !== 'source' ? [...tableEditor, tableEditorTheme] : []),
    bracketMatching(),
    propertiesTheme,
    ...imageControls(),
    markdownLinkClickHandler,
  ];
}
