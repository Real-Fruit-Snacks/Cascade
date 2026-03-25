import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Copy, Info, Replace, FileOutput, Settings } from 'lucide-react';
import { FilePropertiesDialog } from './FilePropertiesDialog';
import { ask } from '@tauri-apps/plugin-dialog';
import { useEditorStore, getTabType } from '../stores/editor-store';
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import { WelcomeView } from './WelcomeView';
import { SkeletonLine } from './Skeleton';
import { useShallow } from 'zustand/react/shallow';
import { useCodeMirror } from '../editor/use-codemirror';
import { StatusBar } from './StatusBar';
import { ContextMenu } from './sidebar/ContextMenu';
import { EditorView } from '@codemirror/view';
import { openSearchPanel } from '@codemirror/search';
import { consumeRightClickCapture } from '../editor/custom-spellcheck';
import { useTranslation } from 'react-i18next';
import { emit, on } from '../lib/cascade-events';

import { FloatingVimBadge } from './editor/FloatingVimBadge';
import { SlashCommandMenu } from './SlashCommandMenu';
import { WelcomeScreen } from './editor/WelcomeScreen';
import { TabBar } from './editor/TabBar';
import { BreadcrumbBar } from './editor/BreadcrumbBar';
import { ViewerPanes } from './editor/ViewerPanes';
import { useTabContextMenu } from '../hooks/useTabContextMenu';
import { useEditorContextMenu } from '../hooks/useEditorContextMenu';
import { useTabDragDrop } from '../hooks/useTabDragDrop';

const SPECIAL_TAB_LABELS: Record<string, { label: string }> = {
  '__graph__': { label: 'Graph' },
};

export function EditorPane({ paneIndex }: { paneIndex?: number } = {}) {
  const { t } = useTranslation('editor');
  const isPane = paneIndex !== undefined;
  const specialTabLabel = (path: string): string | undefined => {
    if (path === '__graph__') return t('specialTabs.graph');
    return undefined;
  };

  // Helper selectors: read from panes[paneIndex] when in split mode, else top-level
  const selectTabs = useCallback((s: ReturnType<typeof useEditorStore.getState>) => {
    if (isPane && paneIndex < s.panes.length) return s.panes[paneIndex].tabs;
    return s.tabs;
  }, [isPane, paneIndex]);

  const selectActiveTabIndex = useCallback((s: ReturnType<typeof useEditorStore.getState>) => {
    if (isPane && paneIndex < s.panes.length) return s.panes[paneIndex].activeTabIndex;
    return s.activeTabIndex;
  }, [isPane, paneIndex]);

  const tabPaths = useEditorStore(useShallow((s) => selectTabs(s).map((t) => t.path)));
  const tabDirty = useEditorStore(useShallow((s) => selectTabs(s).map((t) => t.isDirty)));
  const tabPinned = useEditorStore(useShallow((s) => selectTabs(s).map((t) => !!t.isPinned)));
  const tabTypes = useEditorStore(useShallow((s) => selectTabs(s).map((t) => t.type ?? getTabType(t.path))));
  const tabsMeta = useMemo(() => {
    return tabPaths.map((path, i) => ({ path, isDirty: tabDirty[i], isPinned: tabPinned[i], type: tabTypes[i] }));
  }, [tabPaths, tabDirty, tabPinned, tabTypes]);
  const activeTabIndex = useEditorStore(selectActiveTabIndex);
  const activeFilePath = useEditorStore((s) => {
    const tabs = selectTabs(s);
    const idx = selectActiveTabIndex(s);
    return tabs[idx]?.path ?? null;
  });
  const activeTabType = useEditorStore((s) => {
    const tabs = selectTabs(s);
    const idx = selectActiveTabIndex(s);
    const tab = tabs[idx];
    return tab?.type ?? (tab ? getTabType(tab.path) : 'markdown');
  });
  const isFileLoading = useEditorStore((s) => s.isFileLoading);
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);

  // Track if this pane is the active pane (for focus styling)
  const isActivePane = useEditorStore((s) => !isPane || s.activePaneIndex === paneIndex);
  const hasSplit = useEditorStore((s) => s.panes.length >= 2);
  const enableStatusBar = useSettingsStore((s) => s.enableStatusBar);
  const showWelcomeView = useSettingsStore((s) => s.showWelcomeView);
  const enableCanvas = useSettingsStore((s) => s.enableCanvas);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const focusModeActive = useEditorStore((s) => s.focusModeActive);
  const focusModeDimParagraphs = useSettingsStore((s) => s.focusModeDimParagraphs);
  const focusModeTypewriter = useSettingsStore((s) => s.focusModeTypewriter);

  // Track previous typewriter state so we can restore it when focus mode exits
  const prevTypewriterRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (focusModeActive && focusModeTypewriter) {
      const current = useSettingsStore.getState().enableTypewriterMode;
      prevTypewriterRef.current = current;
      if (!current) {
        useSettingsStore.getState().update({ enableTypewriterMode: true });
      }
    } else if (!focusModeActive && prevTypewriterRef.current !== null) {
      useSettingsStore.getState().update({ enableTypewriterMode: prevTypewriterRef.current });
      prevTypewriterRef.current = null;
    }
  }, [focusModeActive, focusModeTypewriter]);

  const closeTab = useCallback(async (index: number) => {
    const tab = tabsMeta[index];
    if (tab?.isDirty) {
      const s = useSettingsStore.getState();
      if (s.autoSaveEnabled) {
        // Auto-save before closing when autosave is enabled
        const vaultPath = useVaultStore.getState().vaultPath;
        if (vaultPath) {
          if (isPane) {
            await useEditorStore.getState().savePaneFile(paneIndex, vaultPath);
          } else {
            await useEditorStore.getState().saveFile(vaultPath);
          }
        }
      } else {
        const name = tab.path.replace(/\\/g, '/').split('/').pop() ?? tab.path;
        const confirmed = await ask(t('dialogs.unsavedChangesMessage', { name }), { title: t('dialogs.unsavedChangesTitle'), kind: 'warning' });
        if (!confirmed) return;
      }
    }
    if (isPane) {
      useEditorStore.getState().closePaneTab(paneIndex, index, true);
    } else {
      useEditorStore.getState().closeTab(index, true);
    }
  }, [tabsMeta, t, isPane, paneIndex]);

  // Tab drag-drop logic
  const {
    dragVisual,
    measuring,
    visibleIndices,
    overflowTabs,
    overflowMenuOpen,
    setOverflowMenuOpen,
    tabListRef,
    tabContainerRef,
    overflowBtnRef,
    handleTabDoubleClick,
    handleTabMouseDown,
  } = useTabDragDrop({ isPane, paneIndex, t, tabsMeta, activeTabIndex });

  // Pane settings menu
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number } | null>(null);
  const paneMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [filePropsOpen, setFilePropsOpen] = useState(false);

  // Tab context menu
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setTabMenu({ x: e.clientX, y: e.clientY, index });
  }, []);

  const tabMenuItems = useTabContextMenu({ tabMenu, tabsMeta, closeTab, t });

  const setEditorView = useEditorStore((s) => s.setEditorView);
  const setPaneEditorView = useEditorStore((s) => s.setPaneEditorView);
  const { editorRef, setValue, getView, viewRef } = useCodeMirror();

  // Editor context menu
  const [editorMenu, setEditorMenu] = useState<{ x: number; y: number; docPos: number | null; spellcheck: { word: string; from: number; to: number } | null } | null>(null);

  const handleEditorContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const view = getView();
    const capture = view ? consumeRightClickCapture(view) : null;
    const docPos = capture?.docPos ?? null;
    const spellcheck = capture?.spellcheck ?? null;
    setEditorMenu({ x: e.clientX, y: e.clientY, docPos, spellcheck });
  }, [getView]);

  const editorMenuItems = useEditorContextMenu({ editorMenu, getView, t });

  // Expose CM view via store for commands (e.g., find/replace from command palette)
  useEffect(() => {
    if (isPane) {
      setPaneEditorView(paneIndex, getView());
      return () => { setPaneEditorView(paneIndex, null); };
    }
    setEditorView(getView());
    return () => { setEditorView(null); };
  }, [getView, setEditorView, setPaneEditorView, isPane, paneIndex]);

  // Listen for plugin views requesting a tab
  useEffect(() => {
    return on('cascade:open-plugin-view', ({ viewType }) => {
      useEditorStore.getState().openSpecialTab(`__plugin-view:${viewType}`);
    });
  }, []);

  // Sync store content into CodeMirror when active file changes
  useEffect(() => {
    setValue(useEditorStore.getState().content);

    // If a pending scroll line was set (e.g. from search), scroll to it
    const scrollLine = useEditorStore.getState().pendingScrollLine;
    if (scrollLine !== null) {
      useEditorStore.setState({ pendingScrollLine: null });
      requestAnimationFrame(() => {
        const view = getView();
        if (!view) return;
        const totalLines = view.state.doc.lines;
        const clampedLine = Math.max(1, Math.min(scrollLine, totalLines));
        const lineInfo = view.state.doc.line(clampedLine);
        view.dispatch({
          selection: { anchor: lineInfo.from },
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
        });
        view.focus();
      });
    }

    // If a pending heading anchor was set (e.g. from [[note#heading]]), scroll to it
    const scrollHeading = useEditorStore.getState().pendingScrollHeading;
    if (scrollHeading !== null) {
      useEditorStore.setState({ pendingScrollHeading: null });
      requestAnimationFrame(() => {
        const view = getView();
        if (!view) return;
        const target = scrollHeading.toLowerCase().replace(/-/g, ' ').trim();
        const doc = view.state.doc;
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          const m = line.text.match(/^#{1,6}\s+(.+)/);
          if (m && m[1].trim().toLowerCase() === target) {
            view.dispatch({
              selection: { anchor: line.from },
              effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
            });
            view.focus();
            break;
          }
        }
      });
    }

    // If a pending block ID was set (e.g. from [[note^blockid]]), scroll to it
    const scrollBlock = useEditorStore.getState().pendingScrollBlockId;
    if (scrollBlock !== null) {
      useEditorStore.setState({ pendingScrollBlockId: null });
      requestAnimationFrame(() => {
        const view = getView();
        if (!view) return;
        const marker = `^${scrollBlock}`;
        const doc = view.state.doc;
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          if (line.text.trimEnd().endsWith(marker)) {
            view.dispatch({
              selection: { anchor: line.from },
              effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
            });
            view.focus();
            break;
          }
        }
      });
    }
  // Only sync on file switch, not every keystroke (CM manages its own content via updateContent)
  }, [activeFilePath, setValue, getView]);

  const handlePaneFocus = useCallback(() => {
    if (isPane) {
      useEditorStore.getState().setActivePaneIndex(paneIndex);
    }
  }, [isPane, paneIndex]);

  return (
    <div
      className="relative flex flex-col flex-1 h-full overflow-hidden"
      style={{
        backgroundColor: 'var(--ctp-base)',
        ...(isPane && hasSplit ? { outline: isActivePane ? '2px solid var(--ctp-accent)' : 'none', outlineOffset: '-2px' } : {}),
      }}
      onMouseDown={handlePaneFocus}
    >
      {/* Tab bar -- hidden in focus mode */}
      {!focusModeActive && <TabBar
        tabsMeta={tabsMeta}
        activeTabIndex={activeTabIndex}
        dragVisual={dragVisual}
        measuring={measuring}
        visibleIndices={visibleIndices}
        overflowTabs={overflowTabs}
        overflowMenuOpen={overflowMenuOpen}
        setOverflowMenuOpen={setOverflowMenuOpen}
        tabListRef={tabListRef}
        tabContainerRef={tabContainerRef}
        overflowBtnRef={overflowBtnRef}
        handleTabMouseDown={handleTabMouseDown}
        handleTabDoubleClick={handleTabDoubleClick}
        handleTabContextMenu={handleTabContextMenu}
        closeTab={closeTab}
        setTabMenu={setTabMenu}
        specialTabLabel={specialTabLabel}
        isPane={isPane}
        paneIndex={paneIndex}
      />}

      {/* Breadcrumb path bar with view mode controls -- only for markdown file tabs, hidden in focus mode */}
      {!focusModeActive && activeFilePath && !SPECIAL_TAB_LABELS[activeFilePath] && !activeFilePath.startsWith('__plugin-view:') && activeTabType === 'markdown' && (
        <BreadcrumbBar
          activeFilePath={activeFilePath}
          viewMode={viewMode}
          setViewMode={setViewMode}
          paneMenuBtnRef={paneMenuBtnRef}
          setPaneMenu={setPaneMenu}
        />
      )}

      {/* File loading skeleton -- shown while file content is being fetched */}
      {isFileLoading && (
        <div className="flex-1 flex flex-col gap-3 px-8 py-6" style={{ backgroundColor: 'var(--ctp-base)' }}>
          <SkeletonLine width="55%" height="20px" />
          <SkeletonLine width="90%" />
          <SkeletonLine width="80%" />
          <SkeletonLine width="85%" />
          <SkeletonLine width="70%" />
          <SkeletonLine width="92%" />
          <SkeletonLine width="65%" />
          <SkeletonLine width="88%" />
          <SkeletonLine width="75%" />
          <SkeletonLine width="50%" />
          <SkeletonLine width="83%" />
          <SkeletonLine width="78%" />
        </div>
      )}

      <ViewerPanes
        activeFilePath={activeFilePath}
        activeTabType={activeTabType}
        tabPaths={tabPaths}
        vaultPath={vaultPath}
        isFileLoading={isFileLoading}
        enableCanvas={enableCanvas}
      />

      {/* Editor mount -- always rendered so CM instance persists; hidden when no file or special tab active */}
      <div
        ref={editorRef}
        className={`flex-1 overflow-hidden font-mono${focusModeActive && focusModeDimParagraphs ? ' focus-dim-active' : ''}`}
        onContextMenu={handleEditorContextMenu}
        style={{
          backgroundColor: 'var(--ctp-base)',
          display: activeFilePath && !SPECIAL_TAB_LABELS[activeFilePath] && !activeFilePath.startsWith('__plugin-view:') && !isFileLoading && activeTabType === 'markdown' ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      />

      <SlashCommandMenu editorViewRef={viewRef} />

      {/* Welcome screen when no file open */}
      {!activeFilePath && (showWelcomeView ? <WelcomeView /> : <WelcomeScreen />)}

      {/* Status bar -- only for markdown file tabs, when enabled, hidden in focus mode */}
      {!focusModeActive && activeFilePath && !SPECIAL_TAB_LABELS[activeFilePath] && !activeFilePath.startsWith('__plugin-view:') && activeTabType === 'markdown' && enableStatusBar && <StatusBar />}

      {/* Floating vim mode badge when status bar is off */}
      {!enableStatusBar && <FloatingVimBadge />}

      {/* Context menus */}
      {tabMenu && (
        <ContextMenu
          x={tabMenu.x}
          y={tabMenu.y}
          items={tabMenuItems}
          onClose={() => setTabMenu(null)}
        />
      )}
      {editorMenu && (
        <ContextMenu
          x={editorMenu.x}
          y={editorMenu.y}
          items={editorMenuItems}
          onClose={() => setEditorMenu(null)}
        />
      )}
      <FilePropertiesDialog open={filePropsOpen} onClose={() => setFilePropsOpen(false)} />
      {paneMenu && (
        <ContextMenu
          x={paneMenu.x}
          y={paneMenu.y}
          items={[
            { label: t('paneContextMenu.fileProperties'), icon: <Info size={14} />, onClick: () => {
              setFilePropsOpen(true);
            }},
            { label: t('paneContextMenu.revealInFileTree'), icon: <FolderOpen size={14} />, onClick: () => {
              if (activeFilePath) {
                emit('cascade:reveal-in-tree', { path: activeFilePath });
              }
            }},
            { label: t('paneContextMenu.copyFilePath'), icon: <Copy size={14} />, onClick: () => {
              if (activeFilePath) navigator.clipboard.writeText(activeFilePath);
            }},
            { label: '', separator: true, onClick: () => {} },
            { label: t('paneContextMenu.findAndReplace'), icon: <Replace size={14} />, onClick: () => {
              setPaneMenu(null);
              requestAnimationFrame(() => {
                const view = getView();
                if (view) openSearchPanel(view);
              });
            }},
            { label: '', separator: true, onClick: () => {} },
            { label: t('paneContextMenu.export'), icon: <FileOutput size={14} />, onClick: () => {
              emit('cascade:export');
            }},
            { label: t('paneContextMenu.settings'), icon: <Settings size={14} />, onClick: () => {
              emit('cascade:open-settings');
            }},
          ]}
          onClose={() => setPaneMenu(null)}
        />
      )}
    </div>
  );
}
