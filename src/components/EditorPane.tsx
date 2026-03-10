import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, Pin, FolderOpen, FileText, Pencil, Code, BookOpen, ChevronRight, Share2, Scissors, Copy, ClipboardPaste, MousePointerClick, Replace, CopyCheck, FileOutput, MoreVertical, Settings, Info, ChevronDown, Image as ImageIcon, BookPlus, EyeOff, SpellCheck, LayoutGrid } from 'lucide-react';
import { FilePropertiesDialog } from './FilePropertiesDialog';
import { ask } from '@tauri-apps/plugin-dialog';
import { useEditorStore, getTabType } from '../stores/editor-store';
import { ImageViewer } from './ImageViewer';
const PdfViewer = lazy(() => import('./PdfViewer').then((m) => ({ default: m.PdfViewer })));
const CanvasView = lazy(() => import('./canvas/CanvasView').then((m) => ({ default: m.CanvasView })));
import { useVaultStore } from '../stores/vault-store';
import { useSettingsStore } from '../stores/settings-store';
import { WelcomeView } from './WelcomeView';
import { SkeletonLine } from './Skeleton';
import { useShallow } from 'zustand/react/shallow';
import { useCodeMirror } from '../editor/use-codemirror';
const GraphPanel = lazy(() => import('./sidebar/GraphPanel').then((m) => ({ default: m.GraphPanel })));
import { StatusBar, useVimMode } from './StatusBar';
import { ContextMenu, type MenuItem } from './sidebar/ContextMenu';
import type { ViewMode } from '../types/index';
import { extractFrontmatter, parseFrontmatter, getVariableAtPosition } from '../lib/tidemark';
import { EditorView } from '@codemirror/view';
import { openSearchPanel } from '@codemirror/search';
import { consumeRightClickCapture, triggerSpellcheckRebuild } from '../editor/custom-spellcheck';
import { getSuggestions, addToCustomDictionary, ignoreWord } from '../editor/spellcheck-engine';
import { useToastStore } from '../stores/toast-store';
import { usePluginStore } from '../stores/plugin-store';
import { useTranslation } from 'react-i18next';

const FOCUS_DIM_STYLE = `
.focus-dim-paragraphs .cm-line { opacity: 0.3; transition: opacity 0.2s; }
.focus-dim-paragraphs .cm-activeLine { opacity: 1; }
`;

const SPECIAL_TAB_LABELS: Record<string, { label: string; icon: typeof Share2 }> = {
  '__graph__': { label: 'Graph', icon: Share2 },
};

function FloatingVimBadge() {
  const vimMode = useVimMode();
  if (!vimMode) return null;
  return (
    <div
      className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md font-semibold z-10 pointer-events-none"
      style={{
        fontSize: '0.6875rem',
        backgroundColor: vimMode === 'INSERT' ? 'var(--ctp-green)'
          : vimMode === 'VISUAL' || vimMode === 'V-LINE' || vimMode === 'V-BLOCK' ? 'var(--ctp-mauve)'
          : vimMode === 'REPLACE' ? 'var(--ctp-red)'
          : 'var(--ctp-blue)',
        color: 'var(--ctp-base)',
        opacity: 0.9,
      }}
    >
      {vimMode}
    </div>
  );
}

function WelcomeScreen() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const { t } = useTranslation('editor');
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--ctp-overlay1)' }}>
      {vaultPath ? (
        <>
          <FileText size={48} strokeWidth={1} />
          <p className="text-sm">{t('welcomeScreen.selectFile')}</p>
          <p className="text-xs" style={{ color: 'var(--ctp-overlay0)' }}>{t('welcomeScreen.shortcuts')}</p>
        </>
      ) : (
        <>
          <FolderOpen size={48} strokeWidth={1} />
          <p className="text-sm">{t('welcomeScreen.openVault')}</p>
        </>
      )}
    </div>
  );
}

function Breadcrumb({ path }: { path: string }) {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);

  const revealInTree = (segmentIndex: number) => {
    // Expand all folders up to the clicked segment
    for (let i = 0; i < segments.length - 1 && i <= segmentIndex; i++) {
      const folderPath = segments.slice(0, i + 1).join('/');
      localStorage.setItem('cascade-expanded:' + folderPath, 'true');
    }
    // Switch sidebar to files view and trigger re-render
    window.dispatchEvent(new CustomEvent('cascade:reveal-in-tree', {
      detail: { path: segments.slice(0, segmentIndex + 1).join('/') },
    }));
  };

  return (
    <div
      className="flex items-center px-3 min-w-0 flex-1"
      style={{ fontSize: '0.6875rem' }}
    >
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center min-w-0">
            {i > 0 && (
              <ChevronRight size={10} className="shrink-0" style={{ color: 'var(--ctp-overlay0)', margin: '0 2px' }} />
            )}
            <span
              className="truncate cursor-pointer hover:underline"
              style={{ color: isLast ? 'var(--ctp-text)' : 'var(--ctp-subtext0)' }}
              onClick={() => revealInTree(i)}
            >
              {segment}
            </span>
          </span>
        );
      })}
    </div>
  );
}

const VIEW_MODES: { mode: ViewMode; icon: typeof Pencil; labelKey: string }[] = [
  { mode: 'live', icon: Pencil, labelKey: 'viewModes.livePreview' },
  { mode: 'source', icon: Code, labelKey: 'viewModes.source' },
  { mode: 'reading', icon: BookOpen, labelKey: 'viewModes.reading' },
];

export function EditorPane() {
  const { t } = useTranslation('editor');
  const specialTabLabel = (path: string): string | undefined => {
    if (path === '__graph__') return t('specialTabs.graph');
    return undefined;
  };
  const tabPaths = useEditorStore(useShallow((s) => s.tabs.map((t) => t.path)));
  const tabDirty = useEditorStore(useShallow((s) => s.tabs.map((t) => t.isDirty)));
  const tabPinned = useEditorStore(useShallow((s) => s.tabs.map((t) => !!t.isPinned)));
  const tabTypes = useEditorStore(useShallow((s) => s.tabs.map((t) => t.type ?? getTabType(t.path))));
  const tabsMeta = useMemo(
    () => tabPaths.map((path, i) => ({ path, isDirty: tabDirty[i], isPinned: tabPinned[i], type: tabTypes[i] })),
    [tabPaths, tabDirty, tabPinned, tabTypes],
  );
  const activeTabIndex = useEditorStore((s) => s.activeTabIndex);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const activeTabType = useEditorStore((s) => {
    const tab = s.tabs[s.activeTabIndex];
    return tab?.type ?? (tab ? getTabType(tab.path) : 'markdown');
  });
  const isFileLoading = useEditorStore((s) => s.isFileLoading);
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);
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
      const name = tab.path.replace(/\\/g, '/').split('/').pop() ?? tab.path;
      const confirmed = await ask(t('dialogs.unsavedChangesMessage', { name }), { title: t('dialogs.unsavedChangesTitle'), kind: 'warning' });
      if (!confirmed) return;
    }
    useEditorStore.getState().closeTab(index, true);
  }, [tabsMeta, t]);

  // Mouse-based tab reordering state
  // insertSlot: insertion point index (0 = before first tab, n = after last tab)
  const [dragVisual, setDragVisual] = useState<{ from: number; insertSlot: number | null } | null>(null);
  const dragStartX = useRef(0);
  const didDrag = useRef(false);
  const dragInfo = useRef<{ from: number; insertSlot: number | null } | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [overflowStartIndex, setOverflowStartIndex] = useState<number | null>(null);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);

  // Measure tabs and compute overflow split point
  const OVERFLOW_BTN_WIDTH = 36;
  const tabWidthsRef = useRef<number[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);

  // ResizeObserver to track container width
  useEffect(() => {
    const container = tabContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Measure all tab widths — need a full render pass with all tabs visible
  // Force a measurement pass when tabs change by temporarily clearing overflow
  const [measuring, setMeasuring] = useState(false);
  const prevTabCount = useRef(tabsMeta.length);

  useEffect(() => {
    if (tabsMeta.length !== prevTabCount.current) {
      prevTabCount.current = tabsMeta.length;
      setOverflowStartIndex(null); // show all tabs so we can measure
      setMeasuring(true);
    }
  }, [tabsMeta.length]);

  useLayoutEffect(() => {
    const list = tabListRef.current;
    if (!list) return;
    // Only measure when all tabs are rendered (no overflow applied or measuring pass)
    if (overflowStartIndex !== null && !measuring) return;
    const children = Array.from(list.children) as HTMLElement[];
    if (children.length === tabsMeta.length) {
      tabWidthsRef.current = children.map((el) => el.offsetWidth);
      if (measuring) setMeasuring(false);
    }
  }, [tabsMeta.length, measuring, overflowStartIndex]);

  // Compute overflow from cached widths + container width
  useEffect(() => {
    if (tabsMeta.length === 0 || containerWidth === 0) {
      setOverflowStartIndex(null);
      return;
    }

    const widths = tabWidthsRef.current;
    if (widths.length === 0) {
      setOverflowStartIndex(null);
      return;
    }

    let cumWidth = 0;
    let splitIdx: number | null = null;

    // First check if everything fits (reserve button space since it's not rendered yet)
    const totalWidth = widths.reduce((sum, w) => sum + w, 0);
    if (totalWidth <= containerWidth) {
      setOverflowStartIndex(null);
      return;
    }

    // Need overflow — find split point
    // When the overflow button is already visible, containerWidth already accounts
    // for its space (it's a flex sibling). Only subtract button width on the first
    // detection pass when the button hasn't rendered yet.
    const available = overflowStartIndex === null
      ? containerWidth - OVERFLOW_BTN_WIDTH
      : containerWidth;

    for (let i = 0; i < widths.length; i++) {
      cumWidth += widths[i];
      if (cumWidth > available && i > 0) {
        splitIdx = i;
        break;
      }
    }

    setOverflowStartIndex(splitIdx ?? widths.length - 1);
  }, [tabsMeta, containerWidth]);

  // Build visible and overflow tab index sets
  const { visibleIndices, overflowTabs } = useMemo(() => {
    if (overflowStartIndex === null || overflowStartIndex >= tabsMeta.length) {
      return { visibleIndices: new Set(tabsMeta.map((_, i) => i)), overflowTabs: [] as (typeof tabsMeta[0] & { originalIndex: number })[] };
    }

    const visibleSet = new Set<number>();
    for (let i = 0; i < overflowStartIndex; i++) visibleSet.add(i);

    // Ensure active tab is always visible
    if (activeTabIndex !== null && activeTabIndex >= overflowStartIndex) {
      visibleSet.add(activeTabIndex);
      // Remove last visible non-active tab to make room
      if (visibleSet.size > overflowStartIndex) {
        for (let i = overflowStartIndex - 1; i >= 0; i--) {
          if (i !== activeTabIndex) {
            visibleSet.delete(i);
            break;
          }
        }
      }
    }

    // Rebuild overflow from non-visible tabs
    const finalOverflow = tabsMeta
      .map((t, i) => ({ ...t, originalIndex: i }))
      .filter((t) => !visibleSet.has(t.originalIndex));

    return { visibleIndices: visibleSet, overflowTabs: finalOverflow };
  }, [tabsMeta, overflowStartIndex, activeTabIndex]);

  const handleTabDoubleClick = useCallback((e: React.MouseEvent, index: number) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const tab = useEditorStore.getState().tabs[index];
    if (!tab) return;
    if (tab.isPinned) {
      useEditorStore.getState().unpinTab(index);
    } else {
      useEditorStore.getState().pinTab(index);
    }
  }, []);

  const handleTabMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    if (e.button !== 0) {
      if (e.button === 1) {
        e.preventDefault();
        const tab = useEditorStore.getState().tabs[index];
        if (tab?.isPinned) return;
        if (tab?.isDirty) {
          const name = tab.path.replace(/\\/g, '/').split('/').pop() ?? tab.path;
          ask(t('dialogs.unsavedChangesMessage', { name }), { title: t('dialogs.unsavedChangesTitle'), kind: 'warning' }).then((confirmed) => {
            if (confirmed) useEditorStore.getState().closeTab(index, true);
          });
          return;
        }
        useEditorStore.getState().closeTab(index, true);
      }
      return;
    }
    if ((e.target as HTMLElement).closest('button')) return;

    dragStartX.current = e.clientX;
    didDrag.current = false;
    dragInfo.current = null;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = Math.abs(ev.clientX - dragStartX.current);
      if (dx < 5 && !didDrag.current) return;

      if (!didDrag.current) {
        didDrag.current = true;
        document.body.style.cursor = 'grabbing';
        // Show drag visual on first movement
        setDragVisual({ from: index, insertSlot: null });
      }

      const list = tabListRef.current;
      if (!list) return;

      // Calculate insert slot based on cursor vs midpoint of each tab
      const children = Array.from(list.children) as HTMLElement[];
      let insertSlot = children.length; // default: after last
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        if (ev.clientX < mid) {
          insertSlot = i;
          break;
        }
      }

      dragInfo.current = { from: index, insertSlot };
      // Update visual state so drop indicator follows the cursor
      setDragVisual({ from: index, insertSlot });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';

      const info = dragInfo.current;
      dragInfo.current = null;
      setDragVisual(null);

      if (didDrag.current && info && info.insertSlot !== null) {
        // Convert insert slot to target index for moveTab
        const slot = info.insertSlot;
        // The dragged tab will be removed then inserted; compute effective target index
        const targetIndex = slot > index ? slot - 1 : slot;
        if (targetIndex !== index) {
          useEditorStore.getState().moveTab(index, targetIndex);
        }
      } else if (!didDrag.current) {
        useEditorStore.getState().switchTab(index);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

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

  const tabMenuItems = useMemo((): MenuItem[] => {
    if (tabMenu === null) return [];
    const idx = tabMenu.index;
    const tab = tabsMeta[idx];
    if (!tab) return [];
    const items: MenuItem[] = [];
    const isPinned = tab.isPinned;

    items.push({
      label: isPinned ? t('tabContextMenu.unpinTab') : t('tabContextMenu.pinTab'),
      onClick: () => {
        if (isPinned) useEditorStore.getState().unpinTab(idx);
        else useEditorStore.getState().pinTab(idx);
      },
    });

    if (!isPinned) {
      items.push({
        label: t('tabContextMenu.closeTab'),
        onClick: () => closeTab(idx),
      });
    }

    items.push({
      label: t('tabContextMenu.closeTabsToRight'),
      onClick: async () => {
        const store = useEditorStore.getState();
        const hasDirty = store.tabs.some((t, i) => i > idx && !t.isPinned && t.isDirty);
        if (hasDirty) {
          const confirmed = await ask(t('dialogs.closeTabsRightMessage'), { title: t('dialogs.closeTabsRightTitle'), kind: 'warning' });
          if (!confirmed) return;
        }
        const s = useEditorStore.getState();
        for (let i = s.tabs.length - 1; i > idx; i--) {
          if (!s.tabs[i].isPinned) {
            s.closeTab(i, true);
          }
        }
      },
    });

    items.push({
      label: t('tabContextMenu.revealInSidebar'),
      onClick: () => {
        if (tab.path && !tab.path.startsWith('__')) {
          window.dispatchEvent(new CustomEvent('cascade:reveal-in-tree', { detail: { path: tab.path } }));
        }
      },
    });

    items.push({
      label: t('tabContextMenu.copyFilePath'),
      onClick: () => {
        if (tab.path) {
          navigator.clipboard.writeText(tab.path);
        }
      },
    });

    items.push({
      label: t('tabContextMenu.closeOtherTabs'),
      onClick: async () => {
        const store = useEditorStore.getState();
        const hasDirty = store.tabs.some((t, i) => i !== idx && !t.isPinned && t.isDirty);
        if (hasDirty) {
          const confirmed = await ask(t('dialogs.closeOtherTabsMessage'), { title: t('dialogs.closeOtherTabsTitle'), kind: 'warning' });
          if (!confirmed) return;
        }
        const s = useEditorStore.getState();
        for (let i = s.tabs.length - 1; i >= 0; i--) {
          if (i !== idx && !s.tabs[i].isPinned) {
            s.closeTab(i, true);
          }
        }
      },
    });

    items.push({
      label: t('tabContextMenu.closeAllTabs'),
      danger: true,
      onClick: async () => {
        const store = useEditorStore.getState();
        const hasDirty = store.tabs.some((t) => !t.isPinned && t.isDirty);
        if (hasDirty) {
          const confirmed = await ask(t('dialogs.closeAllTabsMessage'), { title: t('dialogs.closeAllTabsTitle'), kind: 'warning' });
          if (!confirmed) return;
        }
        const s = useEditorStore.getState();
        for (let i = s.tabs.length - 1; i >= 0; i--) {
          if (!s.tabs[i].isPinned) {
            s.closeTab(i, true);
          }
        }
      },
    });

    // Append plugin tab context menu items
    const pluginTabItems = Array.from(usePluginStore.getState().contextMenuItems.values())
      .filter((item) => item.context === 'tab')
      .map((item) => ({
        label: item.label,
        onClick: () => item.sandbox.invokeCallback(item.runCallbackId),
      }));
    if (pluginTabItems.length > 0) {
      items.push({ label: '', separator: true, onClick: () => {} });
      items.push(...pluginTabItems);
    }

    return items;
  }, [tabMenu, tabsMeta, closeTab]);

  const setEditorView = useEditorStore((s) => s.setEditorView);
  const { editorRef, setValue, getView } = useCodeMirror();

  // Editor context menu — capture click position for variable detection and spellcheck
  const [editorMenu, setEditorMenu] = useState<{ x: number; y: number; docPos: number | null; spellcheck: { word: string; from: number; to: number } | null } | null>(null);

  const handleEditorContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Use position captured during mousedown (before any live preview reflow)
    const capture = consumeRightClickCapture();
    const docPos = capture?.docPos ?? null;
    const spellcheck = capture?.spellcheck ?? null;
    setEditorMenu({ x: e.clientX, y: e.clientY, docPos, spellcheck });
  }, []);

  const editorMenuItems = useMemo((): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: t('editorContextMenu.cut'),
        icon: <Scissors size={12} />,
        color: 'var(--ctp-peach)',
        onClick: () => {
          const view = getView();
          if (view) {
            const { from, to } = view.state.selection.main;
            const selected = view.state.sliceDoc(from, to);
            if (selected) {
              navigator.clipboard.writeText(selected);
              view.dispatch({ changes: { from, to, insert: '' } });
            }
          }
        },
      },
      {
        label: t('editorContextMenu.copy'),
        icon: <Copy size={12} />,
        color: 'var(--ctp-blue)',
        onClick: () => {
          const view = getView();
          if (view) {
            const { from, to } = view.state.selection.main;
            const selected = view.state.sliceDoc(from, to);
            if (selected) navigator.clipboard.writeText(selected);
          }
        },
      },
      {
        label: t('editorContextMenu.paste'),
        icon: <ClipboardPaste size={12} />,
        color: 'var(--ctp-green)',
        onClick: () => {
          navigator.clipboard.readText().then((text) => {
            const view = getView();
            if (view) {
              const { from, to } = view.state.selection.main;
              view.dispatch({ changes: { from, to, insert: text } });
            }
          });
        },
      },
      {
        label: t('editorContextMenu.selectAll'),
        icon: <MousePointerClick size={12} />,
        color: 'var(--ctp-mauve)',
        onClick: () => {
          const view = getView();
          if (view) {
            view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
          }
        },
      },
    ];

    if (useSettingsStore.getState().enableVariables) {
      // Detect variable at click position
      let variableMatch: { name: string } | null = null;
      const view = getView();
      if (view && editorMenu?.docPos !== null && editorMenu?.docPos !== undefined) {
        const s = useSettingsStore.getState();
        const opts = {
          openDelimiter: s.variablesOpenDelimiter,
          closeDelimiter: s.variablesCloseDelimiter,
          defaultSeparator: s.variablesDefaultSeparator,
          missingValueText: s.variablesMissingText,
          supportNesting: s.variablesSupportNesting,
          caseInsensitive: s.variablesCaseInsensitive,
          arrayJoinSeparator: s.variablesArrayJoinSeparator,
          preserveOnMissing: s.variablesPreserveOnMissing,
        };
        const doc = view.state.doc.toString();
        const fm = extractFrontmatter(doc);
        const frontmatter = fm ? parseFrontmatter(fm.raw) : {};
        const bodyStart = fm?.bodyStart ?? 0;
        const body = doc.slice(bodyStart);
        const bodyOffset = editorMenu.docPos - bodyStart;
        if (bodyOffset >= 0) {
          variableMatch = getVariableAtPosition(body, bodyOffset, frontmatter, opts);
        }
      }

      items.push({
        label: '', separator: true, onClick: () => {},
      });

      // Only show "Set Variable" when a variable is under the mouse
      if (variableMatch) {
        const clickDocPos = editorMenu?.docPos ?? null;
        items.push({
          label: t('editorContextMenu.setVariable', { name: variableMatch.name }),
          icon: <Pencil size={12} />,
          color: 'var(--ctp-green)',
          onClick: () => {
            // Move cursor to right-click position so the handler finds the variable
            const v = getView();
            if (v && clickDocPos !== null) {
              v.dispatch({ selection: { anchor: clickDocPos } });
            }
            // Dispatch after cursor update has been processed
            requestAnimationFrame(() => {
              window.dispatchEvent(new Event('cascade:variables-set'));
            });
          },
        });
      }

      items.push({
        label: t('editorContextMenu.copyLineReplaced'),
        icon: <CopyCheck size={12} />,
        color: 'var(--ctp-blue)',
        onClick: () => window.dispatchEvent(new Event('cascade:variables-copy-line')),
      });
      items.push({
        label: t('editorContextMenu.copySelectionReplaced'),
        icon: <FileOutput size={12} />,
        color: 'var(--ctp-blue)',
        onClick: () => window.dispatchEvent(new Event('cascade:variables-copy-selection')),
      });
      items.push({
        label: t('editorContextMenu.replaceInSelection'),
        icon: <Replace size={12} />,
        color: 'var(--ctp-peach)',
        onClick: () => window.dispatchEvent(new Event('cascade:variables-replace-selection')),
      });
    }

    // Prepend spellcheck items if right-clicked on a misspelled word
    if (editorMenu?.spellcheck) {
      const { word, from, to } = editorMenu.spellcheck;
      const suggestions = getSuggestions(word, 5);
      const spellItems: MenuItem[] = [];

      if (suggestions.length > 0) {
        for (const suggestion of suggestions) {
          spellItems.push({
            label: suggestion,
            icon: <SpellCheck size={12} />,
            color: 'var(--ctp-green)',
            onClick: () => {
              const view = getView();
              if (view) {
                view.dispatch({ changes: { from, to, insert: suggestion } });
              }
            },
          });
        }
      } else {
        spellItems.push({
          label: t('editorContextMenu.noSuggestions'),
          icon: <SpellCheck size={12} />,
          color: 'var(--ctp-overlay0)',
          onClick: () => {},
        });
      }

      spellItems.push({
        label: '', separator: true, onClick: () => {},
      });

      spellItems.push({
        label: t('editorContextMenu.addToDictionary'),
        icon: <BookPlus size={12} />,
        color: 'var(--ctp-blue)',
        onClick: () => {
          addToCustomDictionary(word);
          const view = getView();
          if (view) triggerSpellcheckRebuild(view);
          useToastStore.getState().addToast(t('toast.addedToDictionary', { word }), 'success');
        },
      });

      spellItems.push({
        label: t('editorContextMenu.ignore'),
        icon: <EyeOff size={12} />,
        color: 'var(--ctp-overlay1)',
        onClick: () => {
          ignoreWord(word);
          const view = getView();
          if (view) triggerSpellcheckRebuild(view);
        },
      });

      // Add separator before standard items
      spellItems.push({
        label: '', separator: true, onClick: () => {},
      });

      return [...spellItems, ...items];
    }

    // Append plugin editor context menu items
    const pluginEditorItems = Array.from(usePluginStore.getState().contextMenuItems.values())
      .filter((item) => item.context === 'editor')
      .map((item) => ({
        label: item.label,
        onClick: () => item.sandbox.invokeCallback(item.runCallbackId),
      }));
    if (pluginEditorItems.length > 0) {
      items.push({ label: '', separator: true, onClick: () => {} });
      items.push(...pluginEditorItems);
    }

    return items;
  }, [getView, editorMenu]);

  // Expose CM view via store for commands (e.g., find/replace from command palette)
  useEffect(() => {
    setEditorView(getView());
    return () => { setEditorView(null); };
  }, [getView, setEditorView]);

  // Listen for plugin views requesting a tab
  useEffect(() => {
    const handler = (e: Event) => {
      const { viewType } = (e as CustomEvent).detail as { viewType: string };
      useEditorStore.getState().openSpecialTab(`__plugin-view:${viewType}`);
    };
    window.addEventListener('cascade:open-plugin-view', handler);
    return () => window.removeEventListener('cascade:open-plugin-view', handler);
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

  return (
    <div className="relative flex flex-col flex-1 h-full overflow-hidden" style={{ backgroundColor: 'var(--ctp-base)' }}>
      {focusModeActive && focusModeDimParagraphs && <style>{FOCUS_DIM_STYLE}</style>}
      {/* Tab bar — hidden in focus mode */}
      {!focusModeActive && <div
        className="flex items-center shrink-0"
        style={{ backgroundColor: 'var(--ctp-mantle)', minHeight: 36, borderBottom: '1px solid var(--ctp-surface0)' }}
      >
        {/* Tab list with overflow menu */}
        <div ref={tabContainerRef} className="relative flex-1 min-w-0 overflow-hidden">
          <div
            ref={tabListRef}
            className="flex items-stretch flex-nowrap h-full"
          >
            {tabsMeta.length === 0 && (
              <div className="px-4 py-2 text-sm" style={{ color: 'var(--ctp-overlay0)' }}>
                No file open
              </div>
            )}
            {tabsMeta.map((tab, index) => {
              const isActive = index === activeTabIndex;
              const isHidden = !measuring && !visibleIndices.has(index);
              const special = SPECIAL_TAB_LABELS[tab.path];
              const fileNameRaw = tab.path.replace(/\\/g, '/').split('/').at(-1) ?? tab.path;
              const pluginViewType = tab.path.startsWith('__plugin-view:') ? tab.path.slice('__plugin-view:'.length) : null;
              const fileName = specialTabLabel(tab.path) ?? (pluginViewType ? pluginViewType : fileNameRaw.replace(/\.[^.]+$/, ''));
              const isDragSource = dragVisual?.from === index;
              const showDropBefore = dragVisual !== null && dragVisual.insertSlot === index;
              const showDropAfter = index === tabsMeta.length - 1 && dragVisual !== null && dragVisual.insertSlot === tabsMeta.length;
              return (
                <div key={tab.path} className="relative flex items-stretch shrink-0" style={isHidden ? { display: 'none' } : undefined}>
                  {showDropBefore && (
                    <div
                      className="absolute left-0 top-1 bottom-1 w-0.5 z-20 rounded-full"
                      style={{ backgroundColor: 'var(--ctp-accent)', boxShadow: '0 0 4px var(--ctp-accent)' }}
                    />
                  )}
                  <div
                    className={`group/tab flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-t-2 select-none transition-colors ${isActive ? '' : 'hover:bg-[var(--ctp-surface0)]'}`}
                    style={{
                      backgroundColor: isActive ? 'var(--ctp-base)' : tab.isPinned ? 'var(--ctp-surface0)' : 'var(--ctp-mantle)',
                      color: isActive ? 'var(--ctp-text)' : 'var(--ctp-overlay1)',
                      fontWeight: isActive ? 500 : 400,
                      borderTopColor: isActive ? 'var(--ctp-accent)' : tab.isPinned ? 'var(--ctp-surface2)' : 'transparent',
                      borderBottom: isActive ? '1px solid var(--ctp-base)' : '1px solid transparent',
                      marginBottom: '-1px',
                      opacity: isDragSource ? 0.5 : 1,
                      transform: isDragSource ? 'scale(1.04) translateY(-1px)' : 'none',
                      boxShadow: isDragSource ? '0 4px 12px rgba(0,0,0,0.4)' : 'none',
                      transition: isDragSource ? 'none' : 'background-color 0.15s, opacity 0.15s, transform 0.1s, box-shadow 0.1s',
                      zIndex: isDragSource ? 5 : 'auto',
                      position: 'relative',
                    }}
                    onMouseDown={(e) => handleTabMouseDown(e, index)}
                    onDoubleClick={(e) => handleTabDoubleClick(e, index)}
                    onContextMenu={(e) => handleTabContextMenu(e, index)}
                  >
                    {special && <special.icon size={12} className="shrink-0" style={{ color: isActive ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)' }} />}
                    {!special && tab.type === 'image' && <ImageIcon size={12} className="shrink-0" style={{ color: isActive ? 'var(--ctp-green)' : 'var(--ctp-overlay1)' }} />}
                    {!special && tab.type === 'pdf' && <FileText size={12} className="shrink-0" style={{ color: isActive ? 'var(--ctp-red)' : 'var(--ctp-overlay1)' }} />}
                    <span className="truncate max-w-[140px]" style={{ minWidth: 40 }} title={fileName}>{fileName}</span>
                    {tab.isDirty && !tab.isPinned && (
                      <span className="group-hover/tab:hidden" style={{ color: 'var(--ctp-red)', fontSize: '0.625rem' }}>●</span>
                    )}
                    {tab.isDirty && tab.isPinned && (
                      <span style={{ color: 'var(--ctp-red)', fontSize: '0.625rem' }}>●</span>
                    )}
                    {tab.isPinned ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          useEditorStore.getState().unpinTab(index);
                        }}
                        className="rounded p-0.5 transition-colors hover:bg-[var(--ctp-surface1)]"
                        style={{ color: 'var(--ctp-accent)' }}
                        title={t('tabs.unpinTitle')}
                      >
                        <Pin size={12} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(index);
                        }}
                        className={`rounded p-0.5 transition-colors hover:bg-[var(--ctp-surface0)] ${isActive ? '' : 'opacity-0 group-hover/tab:opacity-100'}`}
                        style={{ color: 'var(--ctp-overlay1)' }}
                        title={t('tabs.closeTitle')}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {showDropAfter && (
                    <div
                      className="absolute right-0 top-1 bottom-1 w-0.5 z-20 rounded-full"
                      style={{ backgroundColor: 'var(--ctp-accent)', boxShadow: '0 0 4px var(--ctp-accent)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Overflow menu button */}
        {overflowTabs.length > 0 && (
          <div className="relative shrink-0 self-stretch flex">
            <button
              ref={overflowBtnRef}
              onClick={() => setOverflowMenuOpen((v) => !v)}
              className="flex items-center justify-center gap-1 px-2 transition-colors text-[var(--ctp-overlay1)] hover:text-[var(--ctp-accent)] h-full"
              title={overflowTabs.length > 1 ? t('tabs.moreTabsPlural', { count: overflowTabs.length }) : t('tabs.moreTabsSingular', { count: overflowTabs.length })}
            >
              <ChevronDown size={14} />
              <span className="text-[10px] font-medium">{overflowTabs.length}</span>
            </button>
            {overflowMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOverflowMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full z-50 py-1 rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: 'var(--ctp-mantle)',
                    border: '1px solid var(--ctp-surface1)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    minWidth: 180,
                    maxWidth: 280,
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}
                >
                  {overflowTabs.map((tab) => {
                    const special = SPECIAL_TAB_LABELS[tab.path];
                    const fileNameRaw = tab.path.replace(/\\/g, '/').split('/').at(-1) ?? tab.path;
                    const pluginViewTypeOverflow = tab.path.startsWith('__plugin-view:') ? tab.path.slice('__plugin-view:'.length) : null;
                    const fileName = specialTabLabel(tab.path) ?? (pluginViewTypeOverflow ? pluginViewTypeOverflow : fileNameRaw.replace(/\.[^.]+$/, ''));
                    return (
                      <div
                        key={tab.path}
                        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors hover:bg-[var(--ctp-surface0)]"
                        onClick={() => {
                          useEditorStore.getState().switchTab(tab.originalIndex);
                          setOverflowMenuOpen(false);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTabMenu({ x: e.clientX, y: e.clientY, index: tab.originalIndex });
                        }}
                      >
                        {special ? (
                          <special.icon size={12} className="shrink-0" style={{ color: 'var(--ctp-overlay1)' }} />
                        ) : tab.type === 'image' ? (
                          <ImageIcon size={12} className="shrink-0" style={{ color: 'var(--ctp-overlay1)' }} />
                        ) : tab.type === 'pdf' ? (
                          <FileText size={12} className="shrink-0" style={{ color: 'var(--ctp-red)' }} />
                        ) : (
                          <FileText size={12} className="shrink-0" style={{ color: 'var(--ctp-overlay1)' }} />
                        )}
                        <span
                          className="text-xs truncate flex-1"
                          style={{ color: 'var(--ctp-text)' }}
                          title={fileName}
                        >
                          {fileName}
                        </span>
                        {tab.isDirty && (
                          <span style={{ color: 'var(--ctp-red)', fontSize: '0.625rem' }}>●</span>
                        )}
                        {!tab.isPinned && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTab(tab.originalIndex);
                            }}
                            className="rounded p-0.5 transition-colors hover:bg-[var(--ctp-surface1)] opacity-0 hover:opacity-100"
                            style={{ color: 'var(--ctp-overlay1)' }}
                            title={t('tabs.closeTitle')}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

      </div>}

      {/* Breadcrumb path bar with view mode controls — only for markdown file tabs, hidden in focus mode */}
      {!focusModeActive && activeFilePath && !SPECIAL_TAB_LABELS[activeFilePath] && !activeFilePath.startsWith('__plugin-view:') && activeTabType === 'markdown' && (
        <div
          className="flex items-center shrink-0 min-w-0"
          style={{
            backgroundColor: 'var(--ctp-mantle)',
            borderBottom: '1px solid var(--ctp-surface0)',
            height: 28,
          }}
        >
          <Breadcrumb path={activeFilePath} />
          <div className="flex items-center gap-0.5 px-2 shrink-0 ml-auto">
            {VIEW_MODES.map(({ mode, icon: Icon, labelKey }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="flex items-center gap-1 px-1.5 py-1 rounded transition-colors text-[11px]"
                style={{
                  color: viewMode === mode ? 'var(--ctp-accent)' : 'var(--ctp-overlay1)',
                  backgroundColor: viewMode === mode ? 'var(--ctp-surface0)' : 'transparent',
                }}
                title={t(labelKey)}
              >
                <Icon size={13} />
                <span>{t(labelKey)}</span>
              </button>
            ))}
            <div style={{ width: 1, height: 16, backgroundColor: 'var(--ctp-surface1)', margin: '0 4px' }} />
            <button
              ref={paneMenuBtnRef}
              onClick={() => {
                const rect = paneMenuBtnRef.current?.getBoundingClientRect();
                if (rect) setPaneMenu({ x: rect.right - 180, y: rect.bottom + 4 });
              }}
              className="p-1.5 rounded transition-colors hover:bg-[var(--ctp-surface0)]"
              style={{ color: 'var(--ctp-overlay1)' }}
              title={t('paneMenu.title')}
              aria-label={t('paneMenu.ariaLabel')}
            >
              <MoreVertical size={14} />
            </button>
          </div>
        </div>
      )}

      {/* File loading skeleton — shown while file content is being fetched */}
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

      {/* Graph tab — kept mounted so zoom/pan state persists across tab switches */}
      {tabPaths.includes('__graph__') && (
        <div
          className="flex-1 overflow-hidden"
          style={{
            display: activeFilePath === '__graph__' ? 'flex' : 'none',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <Suspense fallback={null}><GraphPanel /></Suspense>
        </div>
      )}

      {/* Image viewer */}
      {activeFilePath && activeTabType === 'image' && vaultPath && !isFileLoading && (
        <ImageViewer filePath={activeFilePath} vaultPath={vaultPath} />
      )}

      {/* PDF viewer */}
      {activeFilePath && activeTabType === 'pdf' && vaultPath && !isFileLoading && (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-[var(--ctp-surface2)] border-t-[var(--ctp-accent)] rounded-full animate-spin" /></div>}>
          <PdfViewer filePath={activeFilePath} vaultPath={vaultPath} />
        </Suspense>
      )}

      {/* Canvas view */}
      {activeFilePath && activeTabType === 'canvas' && vaultPath && !isFileLoading && (
        enableCanvas ? (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-[var(--ctp-surface2)] border-t-[var(--ctp-accent)] rounded-full animate-spin" /></div>}>
            <CanvasView filePath={activeFilePath} vaultPath={vaultPath} />
          </Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--ctp-overlay0)' }}>
            <LayoutGrid size={48} style={{ color: 'var(--ctp-surface2)' }} />
            <p className="text-sm">Canvas is disabled</p>
            <button
              className="text-xs px-3 py-1.5 rounded"
              style={{ backgroundColor: 'var(--ctp-surface1)', color: 'var(--ctp-text)' }}
              onClick={() => useSettingsStore.getState().update({ enableCanvas: true })}
            >
              Enable in Settings
            </button>
          </div>
        )
      )}

      {/* Plugin custom views */}
      {activeFilePath?.startsWith('__plugin-view:') && (() => {
        const viewType = activeFilePath.slice('__plugin-view:'.length);
        const view = usePluginStore.getState().customViews.get(viewType);
        if (!view) return null;
        return (
          <iframe
            srcDoc={view.html}
            sandbox="allow-scripts"
            className="w-full h-full"
            style={{ border: 'none', flex: 1 }}
            title={t('pluginView.iframeTitle', { viewType })}
          />
        );
      })()}

      {/* Editor mount — always rendered so CM instance persists; hidden when no file or special tab active */}
      <div
        ref={editorRef}
        className={`flex-1 overflow-hidden font-mono${focusModeActive && focusModeDimParagraphs ? ' focus-dim-paragraphs' : ''}`}
        onContextMenu={handleEditorContextMenu}
        style={{
          backgroundColor: 'var(--ctp-base)',
          display: activeFilePath && !SPECIAL_TAB_LABELS[activeFilePath] && !activeFilePath.startsWith('__plugin-view:') && !isFileLoading && activeTabType === 'markdown' ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      />

      {/* Welcome screen when no file open */}
      {!activeFilePath && (showWelcomeView ? <WelcomeView /> : <WelcomeScreen />)}

      {/* Status bar — only for markdown file tabs, when enabled, hidden in focus mode */}
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
                window.dispatchEvent(new CustomEvent('cascade:reveal-in-tree', { detail: { path: activeFilePath } }));
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
              window.dispatchEvent(new Event('cascade:export'));
            }},
            { label: t('paneContextMenu.settings'), icon: <Settings size={14} />, onClick: () => {
              window.dispatchEvent(new Event('cascade:open-settings'));
            }},
          ]}
          onClose={() => setPaneMenu(null)}
        />
      )}
    </div>
  );
}
