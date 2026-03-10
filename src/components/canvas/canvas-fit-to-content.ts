import { useCanvasStore } from '../../stores/canvas-store';

/**
 * Fit a canvas card's height to its CM6 content.
 *
 * CM6 uses virtual rendering, so scrollHeight changes as the viewport
 * changes size. We shrink the card to minimum first (forcing content
 * overflow so scrollHeight reflects the true size), then expand in
 * two passes to let CM6 re-render and converge on the correct height.
 */
export function fitNodeToContent(nodeId: string, minHeight = 60) {
  const store = useCanvasStore.getState();
  // Push undo once before any mutations so the entire fit operation is a single undo step
  store.pushUndo();
  store.updateNode(nodeId, { height: minHeight }, true);

  requestAnimationFrame(() => setTimeout(() => {
    const applyFit = (pass: number) => {
      const cardEl = document.querySelector(`[data-node-id="${nodeId}"]`);
      if (!cardEl) return;
      const cmScroller = cardEl.querySelector('.cm-scroller') as HTMLElement | null;
      if (!cmScroller) return;
      const headerEl = cardEl.querySelector('[data-card-header]') as HTMLElement | null;
      const headerHeight = headerEl ? headerEl.offsetHeight : 0;
      const borderOverhead = 4;
      const newHeight = Math.round(Math.max(
        cmScroller.scrollHeight + headerHeight + borderOverhead,
        minHeight,
      ));
      const current = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
      if (!current || Math.abs(newHeight - current.height) <= 2) return;
      useCanvasStore.getState().updateNode(nodeId, { height: newHeight }, true);
      if (pass < 2) {
        requestAnimationFrame(() => setTimeout(() => applyFit(pass + 1), 50));
      }
    };
    applyFit(1);
  }, 50));
}
