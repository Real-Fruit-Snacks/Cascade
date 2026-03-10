import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import { useEditorStore } from '../stores/editor-store';
import type { TabMeta } from '../components/editor/TabBar';
import type { TFunction } from 'i18next';

interface UseTabDragDropParams {
  isPane: boolean;
  paneIndex: number | undefined;
  t: TFunction<'editor'>;
  tabsMeta: TabMeta[];
  activeTabIndex: number;
}

export function useTabDragDrop({ isPane, paneIndex, t, tabsMeta, activeTabIndex }: UseTabDragDropParams) {
  // Mouse-based tab reordering state
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

  // Measure all tab widths -- need a full render pass with all tabs visible
  const [measuring, setMeasuring] = useState(false);
  const prevTabCount = useRef(tabsMeta.length);

  useEffect(() => {
    if (tabsMeta.length !== prevTabCount.current) {
      prevTabCount.current = tabsMeta.length;
      setOverflowStartIndex(null);
      setMeasuring(true);
    }
  }, [tabsMeta.length]);

  useLayoutEffect(() => {
    const list = tabListRef.current;
    if (!list) return;
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

    const totalWidth = widths.reduce((sum, w) => sum + w, 0);
    if (totalWidth <= containerWidth) {
      setOverflowStartIndex(null);
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overflowStartIndex is the setter target, not a dependency
  }, [tabsMeta, containerWidth]);

  // Build visible and overflow tab index sets
  const { visibleIndices, overflowTabs } = useMemo(() => {
    if (overflowStartIndex === null || overflowStartIndex >= tabsMeta.length) {
      return { visibleIndices: new Set(tabsMeta.map((_, i) => i)), overflowTabs: [] as (TabMeta & { originalIndex: number })[] };
    }

    const visibleSet = new Set<number>();
    for (let i = 0; i < overflowStartIndex; i++) visibleSet.add(i);

    // Ensure active tab is always visible
    if (activeTabIndex !== null && activeTabIndex >= overflowStartIndex) {
      visibleSet.add(activeTabIndex);
      if (visibleSet.size > overflowStartIndex) {
        for (let i = overflowStartIndex - 1; i >= 0; i--) {
          if (i !== activeTabIndex) {
            visibleSet.delete(i);
            break;
          }
        }
      }
    }

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
        setDragVisual({ from: index, insertSlot: null });
      }

      const list = tabListRef.current;
      if (!list) return;

      const children = Array.from(list.children) as HTMLElement[];
      let insertSlot = children.length;
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        if (ev.clientX < mid) {
          insertSlot = i;
          break;
        }
      }

      dragInfo.current = { from: index, insertSlot };
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
        const slot = info.insertSlot;
        const targetIndex = slot > index ? slot - 1 : slot;
        if (targetIndex !== index) {
          useEditorStore.getState().moveTab(index, targetIndex);
        }
      } else if (!didDrag.current) {
        if (isPane) {
          useEditorStore.getState().switchPaneTab(paneIndex!, index);
        } else {
          useEditorStore.getState().switchTab(index);
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [isPane, paneIndex, t]);

  return {
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
  };
}
