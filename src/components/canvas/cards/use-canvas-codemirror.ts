/**
 * use-canvas-codemirror.ts
 *
 * React hook that manages a CM6 EditorView for canvas file cards.
 * Supports two modes toggled via an `editing` prop:
 *   - reading (preview, readOnly)
 *   - live (editable, live preview)
 *
 * Uses the shared build-extensions pipeline so canvas cards get the same
 * rendering features (wiki-links, tags, math, mermaid, etc.) as the main editor.
 */

import { useCallback, useEffect, useRef } from 'react';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { formattingKeymap } from '../../../editor/formatting-commands';
import { smartListKeymap } from '../../../editor/smart-lists';
import { useSettingsStore } from '../../../stores/settings-store';
import { createCatppuccinExtensions } from '../../../editor/catppuccin-theme';
import {
  type RenderCompartments,
  createRenderCompartments,
  extensionsForMode,
  buildHighlightSyntaxExtensions,
  buildRenderExtensions,
} from '../../../editor/build-extensions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCanvasCodeMirrorOptions {
  content: string;
  editing: boolean;
  onContentChange?: (content: string) => void;
}

// ---------------------------------------------------------------------------
// Canvas-specific theme: transparent bg, no gutters, no outline, hidden cursor
// when not focused, fill height.
// ---------------------------------------------------------------------------

const canvasCardTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '&.cm-editor:focus-visible, &.cm-editor.cm-focused': {
    outline: 'none',
  },
  // Hide the cursor when the editor is not focused
  '&.cm-editor:not(.cm-focused) .cm-cursor': {
    display: 'none !important',
  },
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCanvasCodeMirror(options: UseCanvasCodeMirrorOptions) {
  const { content, editing, onContentChange } = options;

  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef(content);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  // Lazily create compartments once per hook instance
  const compsRef = useRef<RenderCompartments | null>(null);
  if (!compsRef.current) compsRef.current = createRenderCompartments();

  // -----------------------------------------------------------------------
  // editorRef callback — stable (no deps that change)
  // -----------------------------------------------------------------------
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

    const settings = useSettingsStore.getState();
    const comps = compsRef.current!;

    // Build shared rendering extensions in reading mode (default for cards)
    const renderExts = buildRenderExtensions(comps, settings, 'reading');

    const state = EditorState.create({
      doc: contentRef.current,
      extensions: [
        ...renderExts,
        canvasCardTheme,
        closeBrackets(),
        history(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        smartListKeymap,
        formattingKeymap,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            contentRef.current = newContent;
            onContentChangeRef.current?.(newContent);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: node });
    viewRef.current = view;

    // Lazy-load language-data for code block syntax highlighting
    import('@codemirror/language-data').then(({ languages }) => {
      if (viewRef.current !== view) return; // guard against stale view
      view.dispatch({
        effects: comps.markdownComp.reconfigure(
          markdown({ codeLanguages: languages, extensions: [GFM] }),
        ),
      });
    });
  }, []);

  // -----------------------------------------------------------------------
  // Editing mode toggle
  // -----------------------------------------------------------------------
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const comps = compsRef.current!;
    const settings = useSettingsStore.getState();
    const mode = editing ? 'live' : 'reading';
    const exts = extensionsForMode(mode, settings.enableLivePreview);

    view.dispatch({
      effects: [
        comps.livePreviewComp.reconfigure(exts.livePreview),
        comps.readOnlyComp.reconfigure(exts.readOnly),
        comps.highlightSyntaxComp.reconfigure(
          buildHighlightSyntaxExtensions(
            settings.enableLivePreview,
            settings.enableHighlightSyntax,
            settings.highlightColor,
            mode,
          ),
        ),
      ],
    });

    if (editing) {
      view.focus();
    }
  }, [editing]);

  // -----------------------------------------------------------------------
  // Content sync — external file updates
  // -----------------------------------------------------------------------
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc === content) {
      contentRef.current = content;
      return;
    }

    contentRef.current = content;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      annotations: Transaction.addToHistory.of(false),
    });
  }, [content]);

  // -----------------------------------------------------------------------
  // Theme sync — subscribe to theme changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    let prevTheme = useSettingsStore.getState().theme;
    const unsub = useSettingsStore.subscribe((state) => {
      if (state.theme === prevTheme) return;
      prevTheme = state.theme;
      const view = viewRef.current;
      if (!view) return;
      const comps = compsRef.current!;
      view.dispatch({
        effects: comps.themeComp.reconfigure(createCatppuccinExtensions(state.theme)),
      });
    });
    return unsub;
  }, []);

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------
  useEffect(() => {
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------
  const getContent = useCallback((): string => {
    return viewRef.current?.state.doc.toString() ?? '';
  }, []);

  return { editorRef, getContent, viewRef };
}
