import { useCallback, useEffect, useRef } from 'react';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { defaultKeymap, historyKeymap, history, redo, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { openSearchPanel, search, searchKeymap, highlightSelectionMatches, selectNextOccurrence } from '@codemirror/search';
import { createSearchPanel } from './search-in-selection';
import { foldGutter, foldKeymap, foldService } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { createCatppuccinExtensions } from './catppuccin-theme';
import { searchTheme } from './search-theme';
import { cursorLineField } from './cursor-line';
import { wikiLinks, wikiLinkClickHandler, wikiLinkTheme } from './wiki-links';
import { wikiLinkCompletion } from './wiki-link-completion';
import { tags, tagTheme, tagClickHandler, tagAutocompletion } from './tags';
import { tidemarkHighlight, tidemarkTheme } from './tidemark-highlight';
import { dropHandler } from './drop-handler';
import { indentGuides } from './indent-guides';
import { imagePreview } from './image-preview';
import { mathPreview, mathPreviewTheme } from './math-preview';
import { calloutPreview, calloutPreviewTheme } from './callout-preview';
import { mermaidPreview, mermaidPreviewTheme } from './mermaid-preview';
import { queryPreview, queryPreviewTheme } from './query-preview';
import { typewriterMode, typewriterPadding, focusMode } from './typewriter-mode';
import { customSpellcheck } from './custom-spellcheck';
import { initDictionary, setVaultPath as setSpellcheckVault } from './spellcheck-engine';
import { formattingKeymap } from './formatting-commands';
import { smartListKeymap } from './smart-lists';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import {
  type RenderCompartments,
  createRenderCompartments,
  extensionsForMode,
  buildHighlightSyntaxExtensions,
  buildRenderExtensions,
} from './build-extensions';

let contentUpdateTimer: ReturnType<typeof setTimeout> | null = null;

interface Compartments extends RenderCompartments {
  lineNumbersComp: Compartment;
  vimComp: Compartment;
  highlightActiveLineComp: Compartment;
  readableLineLengthComp: Compartment;
  spellcheckComp: Compartment;
  codeFoldingComp: Compartment;
  typewriterComp: Compartment;
  focusModeComp: Compartment;
}

function createCompartments(): Compartments {
  return {
    ...createRenderCompartments(),
    lineNumbersComp: new Compartment(),
    vimComp: new Compartment(),
    highlightActiveLineComp: new Compartment(),
    readableLineLengthComp: new Compartment(),
    spellcheckComp: new Compartment(),
    codeFoldingComp: new Compartment(),
    typewriterComp: new Compartment(),
    focusModeComp: new Compartment(),
  };
}

// Fold fenced code blocks (``` ... ```)
// Cache keyed on doc identity to avoid repeated linear scans
let codeBlockFoldDoc: import('@codemirror/state').Text | null = null;
let codeBlockFoldMap: Map<number, { from: number; to: number }> | null = null;

function getCodeBlockFolds(state: EditorState): Map<number, { from: number; to: number }> {
  if (codeBlockFoldDoc === state.doc && codeBlockFoldMap) return codeBlockFoldMap;
  const folds = new Map<number, { from: number; to: number }>();
  let openLine: { from: number; to: number; number: number } | null = null;
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (line.text.startsWith('```')) {
      if (openLine) {
        folds.set(openLine.from, { from: openLine.to, to: line.to });
        openLine = null;
      } else {
        openLine = { from: line.from, to: line.to, number: i };
      }
    }
  }
  codeBlockFoldDoc = state.doc;
  codeBlockFoldMap = folds;
  return folds;
}

const markdownCodeBlockFold = foldService.of((state, from) => {
  return getCodeBlockFolds(state).get(from) ?? null;
});

const foldGutterTheme = EditorView.theme({
  '.cm-foldGutter .cm-gutterElement': {
    color: 'var(--ctp-overlay0)',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: '0.85em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    color: 'var(--ctp-accent)',
  },
  '.cm-foldPlaceholder': {
    color: 'var(--ctp-overlay0)',
    background: 'none',
    border: 'none',
    padding: '0 2px',
    margin: '0 1px',
    cursor: 'pointer',
    fontSize: 'inherit',
    opacity: '0.4',
  },
  '.cm-foldPlaceholder:hover': {
    opacity: '0.8',
    color: 'var(--ctp-accent)',
  },
});

// Cache heading fold ranges — single O(N) pass instead of O(N) per heading
let headingFoldDoc: import('@codemirror/state').Text | null = null;
let headingFoldLevel = 0;
let headingFoldMap: Map<number, { from: number; to: number }> | null = null;

function getHeadingFolds(state: EditorState, foldMinLevel: number): Map<number, { from: number; to: number }> {
  if (headingFoldDoc === state.doc && headingFoldLevel === foldMinLevel && headingFoldMap) return headingFoldMap;
  const folds = new Map<number, { from: number; to: number }>();
  const headings: { from: number; to: number; level: number }[] = [];

  // Single pass: collect all headings
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const match = line.text.match(/^(#{1,6})\s/);
    if (match) {
      headings.push({ from: line.from, to: line.to, level: match[1].length });
    }
  }

  // For each heading, find fold end via next same-or-higher-level heading
  for (let idx = 0; idx < headings.length; idx++) {
    const h = headings[idx];
    if (h.level < foldMinLevel) continue;
    let end = state.doc.length;
    for (let j = idx + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) {
        end = headings[j].from > 0 ? headings[j].from - 1 : headings[j].from;
        break;
      }
    }
    if (end > h.to) {
      folds.set(h.from, { from: h.to, to: end });
    }
  }

  headingFoldDoc = state.doc;
  headingFoldLevel = foldMinLevel;
  headingFoldMap = folds;
  return folds;
}

function buildCodeFoldingExtensions(
  enabled: boolean,
  foldHeadings: boolean,
  foldCodeBlocks: boolean,
  foldMinLevel: number,
) {
  if (!enabled) return [];
  const services = [];
  if (foldHeadings) {
    services.push(
      foldService.of((state, from) => {
        return getHeadingFolds(state, foldMinLevel).get(from) ?? null;
      }),
    );
  }
  if (foldCodeBlocks) {
    services.push(markdownCodeBlockFold);
  }
  return [...services, foldGutter({ openText: '▾', closedText: '▸' }), foldGutterTheme];
}

export function useCodeMirror() {
  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compsRef = useRef<Compartments | null>(null);
  if (!compsRef.current) compsRef.current = createCompartments();
  const {
    livePreviewComp, readOnlyComp, fontSizeComp, fontFamilyComp,
    lineNumbersComp, themeComp, vimComp, tabSizeComp,
    highlightActiveLineComp, readableLineLengthComp, spellcheckComp,
    wikiLinksComp, tagsComp, tidemarkComp, codeFoldingComp, typewriterComp,
    indentGuidesComp, imagePreviewComp, mathPreviewComp, calloutPreviewComp,
    mermaidPreviewComp, queryPreviewComp, focusModeComp, highlightSyntaxComp,
    markdownComp,
  } = compsRef.current;

  const updateContent = useEditorStore((s) => s.updateContent);
  const saveFile = useEditorStore((s) => s.saveFile);
  const viewMode = useEditorStore((s) => s.viewMode);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const showLineNumbers = useSettingsStore((s) => s.showLineNumbers);

  const theme = useSettingsStore((s) => s.theme);
  const vimMode = useSettingsStore((s) => s.vimMode);
  const tabSize = useSettingsStore((s) => s.tabSize);
  const highlightActiveLineSetting = useSettingsStore((s) => s.highlightActiveLine);
  const readableLineLength = useSettingsStore((s) => s.readableLineLength);
  const spellcheck = useSettingsStore((s) => s.spellcheck);
  const enableWikiLinks = useSettingsStore((s) => s.enableWikiLinks);
  const enableTags = useSettingsStore((s) => s.enableTags);
  const enableLivePreview = useSettingsStore((s) => s.enableLivePreview);
  const enableVariables = useSettingsStore((s) => s.enableVariables);
  const variablesHighlight = useSettingsStore((s) => s.variablesHighlight);
  const variablesOpenDelimiter = useSettingsStore((s) => s.variablesOpenDelimiter);
  const variablesCloseDelimiter = useSettingsStore((s) => s.variablesCloseDelimiter);
  const variablesDefaultSeparator = useSettingsStore((s) => s.variablesDefaultSeparator);
  const variablesMissingText = useSettingsStore((s) => s.variablesMissingText);
  const variablesSupportNesting = useSettingsStore((s) => s.variablesSupportNesting);
  const variablesCaseInsensitive = useSettingsStore((s) => s.variablesCaseInsensitive);
  const variablesPreserveOnMissing = useSettingsStore((s) => s.variablesPreserveOnMissing);
  const enableCodeFolding = useSettingsStore((s) => s.enableCodeFolding);
  const enableTypewriterMode = useSettingsStore((s) => s.enableTypewriterMode);
  const typewriterOffset = useSettingsStore((s) => s.typewriterOffset);
  const enableIndentGuides = useSettingsStore((s) => s.enableIndentGuides);
  const indentGuideColor = useSettingsStore((s) => s.indentGuideColor);
  const indentGuideStyle = useSettingsStore((s) => s.indentGuideStyle);
  const enableImagePreview = useSettingsStore((s) => s.enableImagePreview);
  const imagePreviewMaxHeight = useSettingsStore((s) => s.imagePreviewMaxHeight);
  const enableHighlightSyntax = useSettingsStore((s) => s.enableHighlightSyntax);
  const highlightColor = useSettingsStore((s) => s.highlightColor);
  const foldHeadings = useSettingsStore((s) => s.foldHeadings);
  const foldCodeBlocks = useSettingsStore((s) => s.foldCodeBlocks);
  const foldMinLevel = useSettingsStore((s) => s.foldMinLevel);
  const codeBlockLineNumbers = useSettingsStore((s) => s.codeBlockLineNumbers);
  const livePreviewHeadings = useSettingsStore((s) => s.livePreviewHeadings);
  const livePreviewBold = useSettingsStore((s) => s.livePreviewBold);
  const livePreviewItalic = useSettingsStore((s) => s.livePreviewItalic);
  const livePreviewLinks = useSettingsStore((s) => s.livePreviewLinks);
  const livePreviewImages = useSettingsStore((s) => s.livePreviewImages);
  const livePreviewCodeBlocks = useSettingsStore((s) => s.livePreviewCodeBlocks);
  const enableMathPreview = useSettingsStore((s) => s.enableMathPreview);
  const enableCalloutPreview = useSettingsStore((s) => s.enableCalloutPreview);
  const enableMermaidPreview = useSettingsStore((s) => s.enableMermaidPreview);
  const enableQueryPreview = useSettingsStore((s) => s.enableQueryPreview);
  const enableFocusMode = useSettingsStore((s) => s.enableFocusMode);
  const focusModeDimParagraphs = useSettingsStore((s) => s.focusModeDimParagraphs);
  const wikiLinksShowFullPath = useSettingsStore((s) => s.wikiLinksShowFullPath);
  const tagsNestedSupport = useSettingsStore((s) => s.tagsNestedSupport);
  const spellcheckSkipCapitalized = useSettingsStore((s) => s.spellcheckSkipCapitalized);
  const enableProperties = useSettingsStore((s) => s.enableProperties);
  const propertiesShowTypes = useSettingsStore((s) => s.propertiesShowTypes);
  // Ref avoids re-creating the EditorView when save dependencies change
  const handleSaveRef = useRef(() => {});
  handleSaveRef.current = () => {
    if (vaultPath) {
      saveFile(vaultPath);
    }
  };

  const editorRef = useCallback((node: HTMLElement | null) => {
    if (node === null) {
      viewRef.current?.destroy();
      viewRef.current = null;
      containerRef.current = null;
      return;
    }

    if (containerRef.current === node) return;
    containerRef.current = node;

    viewRef.current?.destroy();

    const saveKeymap = keymap.of([
      {
        key: 'Ctrl-s',
        mac: 'Cmd-s',
        run: () => {
          handleSaveRef.current();
          return true;
        },
      },
    ]);

    const settings = useSettingsStore.getState();
    const initialMode = useEditorStore.getState().viewMode;

    // Build shared rendering extensions via the shared builder
    const renderExts = buildRenderExtensions(compsRef.current!, settings, initialMode);

    const state = EditorState.create({
      extensions: [
        // Shared rendering extensions (live preview, wiki-links, tags, math, etc.)
        // Note: cursorLineField is included in renderExts (required by frontmatterField)
        ...renderExts,
        // Editor-specific extensions below
        vimComp.of([]),
        lineNumbersComp.of(settings.showLineNumbers ? lineNumbers() : []),
        highlightActiveLineComp.of(settings.highlightActiveLine ? highlightActiveLine() : []),
        readableLineLengthComp.of(settings.readableLineLength > 0 ? EditorView.theme({ '.cm-content': { maxWidth: `${settings.readableLineLength}px`, marginLeft: 'auto', marginRight: 'auto' } }) : []),
        spellcheckComp.of(settings.spellcheck ? customSpellcheck : []),
        codeFoldingComp.of(buildCodeFoldingExtensions(settings.enableCodeFolding, settings.foldHeadings, settings.foldCodeBlocks, settings.foldMinLevel)),
        typewriterComp.of(settings.enableTypewriterMode ? [typewriterMode(settings.typewriterOffset), typewriterPadding] : []),
        focusModeComp.of(settings.enableFocusMode && settings.focusModeDimParagraphs ? focusMode : []),
        closeBrackets(),
        rectangularSelection(),
        crosshairCursor(),
        search({ top: true, createPanel: createSearchPanel }),
        searchTheme,
        highlightSelectionMatches(),
        history(),
        keymap.of([
          { key: 'Mod-h', run: (view) => { openSearchPanel(view); return true; } },
          { key: 'Mod-y', run: redo },
          { key: 'Mod-d', run: selectNextOccurrence, preventDefault: true },
          ...closeBracketsKeymap, ...foldKeymap, ...searchKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap,
        ]),
        saveKeymap,
        smartListKeymap,
        formattingKeymap,
        dropHandler,
        // Prevent right-click from moving cursor / triggering live preview edit mode
        // Return true to consume for CM6 (no cursor move), but don't preventDefault
        EditorView.domEventHandlers({
          mousedown(event) {
            if (event.button === 2) return true;
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            if (contentUpdateTimer) clearTimeout(contentUpdateTimer);
            contentUpdateTimer = setTimeout(() => {
              const content = update.state.doc.toString();
              updateContent(content);
              contentUpdateTimer = null;
            }, 100);

            if (debounceRef.current) clearTimeout(debounceRef.current);
            const s = useSettingsStore.getState();
            if (s.autoSaveEnabled && s.autoSaveMode === 'timer') {
              debounceRef.current = setTimeout(() => {
                if (useEditorStore.getState().isDirty) {
                  handleSaveRef.current();
                }
              }, s.autoSaveInterval);
            }
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: node });
    viewRef.current = view;

    // Load vim mode dynamically if enabled at startup
    if (settings.vimMode) {
      import('@replit/codemirror-vim').then(({ vim }) => {
        view.dispatch({ effects: vimComp.reconfigure(vim()) });
      });
    }

    // B1: Load language-data lazily (~95KB) for code block syntax highlighting
    import('@codemirror/language-data').then(({ languages }) => {
      view.dispatch({
        effects: markdownComp.reconfigure(
          markdown({ codeLanguages: languages, extensions: [GFM] })
        ),
      });
    });

  }, [updateContent]);

  // Auto-save on focus change (editor blur, window blur, or visibility change)
  useEffect(() => {
    const handleFocusLoss = () => {
      const s = useSettingsStore.getState();
      if (s.autoSaveEnabled && s.autoSaveMode === 'focus-change' && useEditorStore.getState().isDirty) {
        handleSaveRef.current();
      }
    };
    const handleVisChange = () => { if (document.hidden) handleFocusLoss(); };
    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('visibilitychange', handleVisChange);
    // Also save when the editor itself loses focus (e.g. clicking sidebar, switching tabs)
    const view = viewRef.current;
    const editorDom = view?.dom;
    if (editorDom) {
      editorDom.addEventListener('focusout', handleFocusLoss);
    }
    return () => {
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('visibilitychange', handleVisChange);
      if (editorDom) {
        editorDom.removeEventListener('focusout', handleFocusLoss);
      }
    };
  }, []);

  // Reconfigure compartments when viewMode or enableLivePreview changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const exts = extensionsForMode(viewMode, enableLivePreview);
    view.dispatch({
      effects: [
        livePreviewComp.reconfigure(exts.livePreview),
        highlightSyntaxComp.reconfigure(buildHighlightSyntaxExtensions(enableLivePreview, enableHighlightSyntax, highlightColor, viewMode)),
        readOnlyComp.reconfigure(exts.readOnly),
      ],
    });
  }, [viewMode, enableLivePreview, enableHighlightSyntax, highlightColor]);

  // Font settings
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        fontSizeComp.reconfigure(EditorView.theme({
          '.cm-content': { fontSize: fontSize + 'px' },
          '.cm-gutters': { fontSize: fontSize + 'px' },
        })),
        fontFamilyComp.reconfigure(EditorView.theme({
          '.cm-content': { fontFamily },
          '.cm-scroller': { fontFamily },
        })),
      ],
    });
  }, [fontSize, fontFamily]);

  // Display settings (line numbers, wrapping, active line highlight)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        lineNumbersComp.reconfigure(showLineNumbers ? lineNumbers() : []),
        highlightActiveLineComp.reconfigure(highlightActiveLineSetting ? highlightActiveLine() : []),
        readableLineLengthComp.reconfigure(readableLineLength > 0 ? EditorView.theme({ '.cm-content': { maxWidth: `${readableLineLength}px`, marginLeft: 'auto', marginRight: 'auto' } }) : []),
      ],
    });
  }, [showLineNumbers, highlightActiveLineSetting, readableLineLength]);

  // Theme
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: themeComp.reconfigure(createCatppuccinExtensions(theme)) });
  }, [theme]);

  // Tab size
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: tabSizeComp.reconfigure(EditorState.tabSize.of(tabSize)) });
  }, [tabSize]);

  // Spellcheck
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: spellcheckComp.reconfigure(spellcheck ? customSpellcheck : []) });
  }, [spellcheck]);

  // Spellcheck sub-setting: skip capitalized words
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !spellcheck) return;
    view.dispatch({ effects: spellcheckComp.reconfigure(customSpellcheck) });
  }, [spellcheckSkipCapitalized]);

  // Initialize spellcheck dictionary with vault path
  useEffect(() => {
    if (vaultPath) {
      initDictionary(vaultPath).then(() => {
        setSpellcheckVault(vaultPath);
      });
    }
  }, [vaultPath]);

  // Wiki links
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: wikiLinksComp.reconfigure(enableWikiLinks ? [wikiLinks, wikiLinkClickHandler, wikiLinkTheme, wikiLinkCompletion] : []) });
  }, [enableWikiLinks, wikiLinksShowFullPath]);

  // Tags
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: tagsComp.reconfigure(enableTags ? [tags, tagTheme, tagClickHandler, tagAutocompletion] : []) });
  }, [enableTags, tagsNestedSupport]);

  // Tidemark/variables highlight
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: tidemarkComp.reconfigure(enableVariables && variablesHighlight ? [tidemarkHighlight, tidemarkTheme] : []) });
  }, [enableVariables, variablesHighlight, variablesOpenDelimiter, variablesCloseDelimiter, variablesDefaultSeparator, variablesMissingText, variablesSupportNesting, variablesCaseInsensitive, variablesPreserveOnMissing]);

  // Code folding (with sub-options)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: codeFoldingComp.reconfigure(buildCodeFoldingExtensions(enableCodeFolding, foldHeadings, foldCodeBlocks, foldMinLevel)) });
  }, [enableCodeFolding, foldHeadings, foldCodeBlocks, foldMinLevel]);

  // Typewriter mode
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: typewriterComp.reconfigure(enableTypewriterMode ? [typewriterMode(typewriterOffset), typewriterPadding] : []) });
  }, [enableTypewriterMode, typewriterOffset]);

  // Focus mode
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: focusModeComp.reconfigure(enableFocusMode && focusModeDimParagraphs ? focusMode : []) });
  }, [enableFocusMode, focusModeDimParagraphs]);

  // Indent guides
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: indentGuidesComp.reconfigure(enableIndentGuides ? indentGuides(indentGuideColor, indentGuideStyle) : []) });
  }, [enableIndentGuides, indentGuideColor, indentGuideStyle]);

  // Image preview
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: imagePreviewComp.reconfigure(enableImagePreview ? imagePreview(imagePreviewMaxHeight) : []) });
  }, [enableImagePreview, imagePreviewMaxHeight]);

  // Math preview
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: mathPreviewComp.reconfigure(enableMathPreview ? [mathPreview, mathPreviewTheme] : []) });
  }, [enableMathPreview]);

  // Callout preview
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: calloutPreviewComp.reconfigure(enableCalloutPreview ? [calloutPreview, calloutPreviewTheme] : []) });
  }, [enableCalloutPreview]);

  // Mermaid preview
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: mermaidPreviewComp.reconfigure(enableMermaidPreview ? [mermaidPreview, mermaidPreviewTheme] : []) });
  }, [enableMermaidPreview]);

  // Query preview
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: queryPreviewComp.reconfigure(enableQueryPreview ? [queryPreview, queryPreviewTheme] : []) });
  }, [enableQueryPreview]);

  // Live preview: reconfigure when any sub-toggle or related setting changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const exts = extensionsForMode(viewMode, enableLivePreview);
    view.dispatch({ effects: livePreviewComp.reconfigure(exts.livePreview) });
  }, [codeBlockLineNumbers, livePreviewHeadings, livePreviewBold, livePreviewItalic, livePreviewLinks, livePreviewImages, livePreviewCodeBlocks, viewMode, enableLivePreview, enableProperties, propertiesShowTypes]);

  // Reconfigure vim mode dynamically (lazy-loaded)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (vimMode) {
      import('@replit/codemirror-vim').then(({ vim }) => {
        view.dispatch({ effects: vimComp.reconfigure(vim()) });
      });
    } else {
      view.dispatch({ effects: vimComp.reconfigure([]) });
    }
  }, [vimMode]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const setValue = useCallback((content: string) => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === content) return;

    // Check if the tab has a saved cursor position
    const store = useEditorStore.getState();
    const tab = store.tabs[store.activeTabIndex];
    let cursorPos = tab?.cursorPos ?? 0;

    // If no saved position, default to after frontmatter
    if (!tab?.cursorPos && tab?.cursorPos !== 0) {
      cursorPos = 0;
      if (content.startsWith('---')) {
        const end = content.indexOf('\n---', 3);
        if (end !== -1) {
          cursorPos = end + 4;
          if (cursorPos < content.length && content[cursorPos] === '\n') cursorPos++;
        }
      }
    }

    // Clamp cursor to valid range
    cursorPos = Math.min(cursorPos, content.length);

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      selection: { anchor: cursorPos },
      annotations: Transaction.addToHistory.of(false),
    });

    // Restore scroll position if saved
    if (tab?.scrollTop != null) {
      requestAnimationFrame(() => {
        view.scrollDOM.scrollTop = tab.scrollTop!;
      });
    }
  }, []);

  const getValue = useCallback((): string => {
    return viewRef.current?.state.doc.toString() ?? '';
  }, []);

  const getView = useCallback(() => viewRef.current, []);

  return { editorRef, setValue, getValue, getView };
}
