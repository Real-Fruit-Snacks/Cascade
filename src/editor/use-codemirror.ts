import { useCallback, useEffect, useRef } from 'react';
import { Prec, Transaction, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { GFM } from '@lezer/markdown';
import { markdown } from '@codemirror/lang-markdown';
import { createCatppuccinExtensions } from './catppuccin-theme';
import { wikiLinks, wikiLinkClickHandler, wikiLinkTheme } from './wiki-links';
import { wikiLinkCompletion } from './wiki-link-completion';
import { tags, tagTheme, tagClickHandler, tagAutocompletion } from './tags';
import { tidemarkHighlight, tidemarkTheme } from './tidemark-highlight';
import { indentGuides } from './indent-guides';
import { imagePreview } from './image-preview';
import { tableEditor, tableEditorTheme } from './table-editor';
import { mathPreview, mathPreviewTheme } from './math-preview';
import { calloutPreview, calloutPreviewTheme } from './callout-preview';
import { mermaidPreview, mermaidPreviewTheme } from './mermaid-preview';
import { queryPreview, queryPreviewTheme } from './query-preview';
import { typewriterMode, typewriterPadding, focusMode } from './typewriter-mode';
import { customSpellcheck } from './custom-spellcheck';
import { slashCommandExtension } from './slash-commands/slash-command-extension';
import { initDictionary, setVaultPath as setSpellcheckVault } from './spellcheck-engine';
import { useEditorStore } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import {
  extensionsForMode,
  buildHighlightSyntaxExtensions,
  buildRenderExtensions,
} from './build-extensions';
import { type Compartments, createCompartments, buildCodeFoldingExtensions, buildEditorExtensions } from './codemirror-extensions';
import { createMousedownHandler, createUpdateListener } from './codemirror-handlers';
import { useCollabStore } from '../stores/collab-store';
import { useToastStore } from '../stores/toast-store';
import { getGlobalProvider, getGlobalDocManager } from '../lib/collab-init';
import { buildCollabExtension } from './collab-extension';

export function useCodeMirror() {
  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compsRef = useRef<Compartments | null>(null);
  if (!compsRef.current) compsRef.current = createCompartments();
  const {
    livePreviewComp, readOnlyComp, fontSizeComp, fontFamilyComp,
    lineNumbersComp, themeComp, vimComp, tabSizeComp,
    highlightActiveLineComp, readableLineLengthComp, spellcheckComp,
    wikiLinksComp, tagsComp, tidemarkComp, codeFoldingComp, typewriterComp,
    indentGuidesComp, imagePreviewComp, mathPreviewComp, calloutPreviewComp,
    mermaidPreviewComp, queryPreviewComp, focusModeComp, highlightSyntaxComp,
    markdownComp, slashCommandsComp, collabComp, tableEditorComp,
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
  const enableSlashCommands = useSettingsStore((s) => s.enableSlashCommands);

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
      if (contentUpdateTimerRef.current) {
        clearTimeout(contentUpdateTimerRef.current);
        contentUpdateTimerRef.current = null;
      }
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
        // Editor-specific extensions
        ...buildEditorExtensions(compsRef.current!, settings, saveKeymap, [
          createMousedownHandler(),
          createUpdateListener(updateContent, debounceRef, handleSaveRef, contentUpdateTimerRef),
        ]),
      ],
    });

    const view = new EditorView({ state, parent: node });
    viewRef.current = view;

    // Load vim mode dynamically if enabled at startup
    if (settings.vimMode) {
      import('@replit/codemirror-vim').then(({ vim }) => {
        view.dispatch({ effects: vimComp.reconfigure(Prec.highest(vim())) });
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
    const isSource = viewMode === 'source';
    view.dispatch({
      effects: [
        livePreviewComp.reconfigure(exts.livePreview),
        highlightSyntaxComp.reconfigure(buildHighlightSyntaxExtensions(enableLivePreview, enableHighlightSyntax, highlightColor, viewMode)),
        readOnlyComp.reconfigure(exts.readOnly),
        // Disable all preview decorations in source mode — show raw markdown only
        wikiLinksComp.reconfigure(enableWikiLinks
          ? isSource ? [wikiLinkCompletion] : [wikiLinks, wikiLinkClickHandler, wikiLinkTheme, wikiLinkCompletion]
          : []),
        tagsComp.reconfigure(enableTags
          ? isSource ? [tagAutocompletion] : [tags, tagTheme, tagClickHandler, tagAutocompletion]
          : []),
        tidemarkComp.reconfigure(enableVariables && variablesHighlight && !isSource ? [tidemarkHighlight, tidemarkTheme] : []),
        imagePreviewComp.reconfigure(enableImagePreview && !isSource ? imagePreview(imagePreviewMaxHeight) : []),
        mathPreviewComp.reconfigure(enableMathPreview && !isSource ? [mathPreview, mathPreviewTheme] : []),
        calloutPreviewComp.reconfigure(enableCalloutPreview && !isSource ? [calloutPreview, calloutPreviewTheme] : []),
        mermaidPreviewComp.reconfigure(enableMermaidPreview && !isSource ? [mermaidPreview, mermaidPreviewTheme] : []),
        queryPreviewComp.reconfigure(enableQueryPreview && !isSource ? [queryPreview, queryPreviewTheme] : []),
        tableEditorComp.reconfigure(!isSource ? [...tableEditor, tableEditorTheme] : []),
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

  // Image preview (disabled in source mode)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: imagePreviewComp.reconfigure(enableImagePreview && viewMode !== 'source' ? imagePreview(imagePreviewMaxHeight) : []) });
  }, [enableImagePreview, imagePreviewMaxHeight, viewMode]);

  // Math preview (disabled in source mode)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: mathPreviewComp.reconfigure(enableMathPreview && viewMode !== 'source' ? [mathPreview, mathPreviewTheme] : []) });
  }, [enableMathPreview, viewMode]);

  // Callout preview (disabled in source mode)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: calloutPreviewComp.reconfigure(enableCalloutPreview && viewMode !== 'source' ? [calloutPreview, calloutPreviewTheme] : []) });
  }, [enableCalloutPreview, viewMode]);

  // Mermaid preview (disabled in source mode)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: mermaidPreviewComp.reconfigure(enableMermaidPreview && viewMode !== 'source' ? [mermaidPreview, mermaidPreviewTheme] : []) });
  }, [enableMermaidPreview, viewMode]);

  // Query preview (disabled in source mode)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: queryPreviewComp.reconfigure(enableQueryPreview && viewMode !== 'source' ? [queryPreview, queryPreviewTheme] : []) });
  }, [enableQueryPreview, viewMode]);

  // Slash commands
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: slashCommandsComp.reconfigure(enableSlashCommands ? slashCommandExtension : []) });
  }, [enableSlashCommands]);

  // Collaboration: bind/unbind yCollab extension when active file or collab state changes
  const collabActive = useCollabStore((s) => s.active);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (!collabActive || !activeFilePath) {
      view.dispatch({ effects: collabComp.reconfigure([]) });
      return;
    }

    const docManager = getGlobalDocManager();
    const provider = getGlobalProvider();
    if (!provider) {
      view.dispatch({ effects: collabComp.reconfigure([]) });
      return;
    }

    const tab = useEditorStore.getState().tabs.find((t) => t.path === activeFilePath);
    const initialContent = tab?.content ?? '';
    const ydoc = docManager.getOrCreate(activeFilePath);
    docManager.initializeIfEmpty(activeFilePath, initialContent);
    const ytext = ydoc.getText('content');

    provider.registerDoc(activeFilePath, ydoc);
    useCollabStore.getState().addActiveDoc(activeFilePath);

    // Update awareness with active file
    provider.setLocalState({
      user: {
        name: useCollabStore.getState().userName,
        color: useCollabStore.getState().userColor,
        activeFile: activeFilePath,
      },
    });

    const docCount = docManager.activePaths().size;
    if (docCount === 20) {
      useToastStore.getState().addToast(
        `${docCount} files open for collaboration. Consider closing some for best performance.`,
        'warning',
      );
    }

    view.dispatch({ effects: collabComp.reconfigure(buildCollabExtension(ytext, provider.awareness)) });

    return () => {
      view.dispatch({ effects: collabComp.reconfigure([]) });
      provider.unregisterDoc(activeFilePath);
      docManager.removeRef(activeFilePath);
      useCollabStore.getState().removeActiveDoc(activeFilePath);
      // Clear active file from awareness
      provider.setLocalState({
        user: {
          name: useCollabStore.getState().userName,
          color: useCollabStore.getState().userColor,
          activeFile: null,
        },
      });
    };
  }, [collabActive, activeFilePath]);

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
        view.dispatch({ effects: vimComp.reconfigure(Prec.highest(vim())) });
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

  return { editorRef, setValue, getValue, getView, viewRef };
}
