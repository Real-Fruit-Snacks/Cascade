import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { writeCanvasClipboard, readCanvasClipboard } from './canvas-utils';
import { DEFAULT_GRID_SIZE } from './canvas-types';

interface UseCanvasKeyboardShortcutsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  setShowSearch: (show: boolean) => void;
}

export function useCanvasKeyboardShortcuts({ containerRef, setShowSearch }: UseCanvasKeyboardShortcutsOptions) {
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const spaceDown = useRef(false);

  // Space key tracking + keyboard shortcuts
  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null): boolean => {
      if (!t || !(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditableTarget(e.target)) {
        spaceDown.current = true;
        e.preventDefault();
        return;
      }

      if (isEditableTarget(e.target)) return;

      const store = useCanvasStore.getState();
      const ctrl = e.ctrlKey || e.metaKey;

      if (store.canvasLocked) {
        if (e.key === 'Escape') { store.clearSelection(); return; }
        if (ctrl && e.key === 'a') { store.selectAll(); e.preventDefault(); return; }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedNodeIds.size > 0) {
          store.removeNodes([...store.selectedNodeIds]);
          e.preventDefault();
        } else if (store.selectedEdgeIds.size > 0) {
          store.removeEdges([...store.selectedEdgeIds]);
          e.preventDefault();
        }
        return;
      }

      if (ctrl && e.key === 'a') {
        store.selectAll();
        e.preventDefault();
        return;
      }

      if (ctrl && !e.shiftKey && e.key === 'z') {
        store.undo();
        e.preventDefault();
        return;
      }

      if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
        store.redo();
        e.preventDefault();
        return;
      }

      if (ctrl && e.key === 'c') {
        const selectedNodes = store.nodes.filter((n) => store.selectedNodeIds.has(n.id));
        if (selectedNodes.length > 0) {
          const selectedIds = new Set(selectedNodes.map((n) => n.id));
          const internalEdges = store.edges.filter(
            (ed) => selectedIds.has(ed.fromNode) && selectedIds.has(ed.toNode),
          );
          writeCanvasClipboard({
            nodes: selectedNodes.map((n) => ({ ...n })),
            edges: internalEdges.map((ed) => ({ ...ed })),
          });
          e.preventDefault();
        }
        return;
      }

      if (ctrl && e.key === 'v') {
        e.preventDefault();
        readCanvasClipboard().then((clipData) => {
          if (!clipData || clipData.nodes.length === 0) return;
          store.pushUndo();
          const idMap = new Map<string, string>();
          const pastedNodeIds: string[] = [];
          for (const node of clipData.nodes) {
            const { id: oldId, ...rest } = node;
            store.addNode({ ...rest, x: node.x + DEFAULT_GRID_SIZE, y: node.y + DEFAULT_GRID_SIZE }, true);
            const newId = useCanvasStore.getState().nodes.at(-1)?.id;
            if (newId) {
              idMap.set(oldId, newId);
              pastedNodeIds.push(newId);
            }
          }
          for (const edge of clipData.edges) {
            const newFrom = idMap.get(edge.fromNode);
            const newTo = idMap.get(edge.toNode);
            if (newFrom && newTo) {
              store.addEdge({
                fromNode: newFrom,
                fromSide: edge.fromSide,
                toNode: newTo,
                toSide: edge.toSide,
              });
            }
          }
          useCanvasStore.setState((s) => ({
            ...s,
            selectedNodeIds: new Set(pastedNodeIds),
            selectedEdgeIds: new Set(),
          }));
        });
        return;
      }

      if (ctrl && e.key === 'd') {
        const selectedNodes = store.nodes.filter((n) => store.selectedNodeIds.has(n.id));
        if (selectedNodes.length > 0) {
          store.pushUndo();
          for (const node of selectedNodes) {
            const { id: _id, ...rest } = node;
            store.addNode({ ...rest, x: node.x + 20, y: node.y + 20 }, true);
          }
          e.preventDefault();
        }
        return;
      }

      if (ctrl && e.key === 'f') {
        setShowSearch(true);
        e.preventDefault();
        return;
      }

      if (ctrl && e.key === '0') {
        store.zoomToFit();
        e.preventDefault();
        return;
      }

      if (ctrl && (e.key === '=' || e.key === '+')) {
        const vp = store.viewport;
        const cs = store.containerSize;
        const oldZoom = vp.zoom;
        const newZoom = Math.min(4, oldZoom * 1.25);
        const cx = cs.width / 2;
        const cy = cs.height / 2;
        const wx = cx / oldZoom - vp.x;
        const wy = cy / oldZoom - vp.y;
        store.setViewport({ x: cx / newZoom - wx, y: cy / newZoom - wy, zoom: newZoom });
        e.preventDefault();
        return;
      }

      if (ctrl && e.key === '-') {
        const vp = store.viewport;
        const cs = store.containerSize;
        const oldZoom = vp.zoom;
        const newZoom = Math.max(0.25, oldZoom * 0.8);
        const cx = cs.width / 2;
        const cy = cs.height / 2;
        const wx = cx / oldZoom - vp.x;
        const wy = cy / oldZoom - vp.y;
        store.setViewport({ x: cx / newZoom - wx, y: cy / newZoom - wy, zoom: newZoom });
        e.preventDefault();
        return;
      }

      if (ctrl && e.key === 'l') {
        if (store.selectedNodeIds.size > 0) {
          store.toggleLock([...store.selectedNodeIds]);
          e.preventDefault();
        }
        return;
      }

      const nudge = e.shiftKey ? 20 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft')  dx = -nudge;
      if (e.key === 'ArrowRight') dx =  nudge;
      if (e.key === 'ArrowUp')    dy = -nudge;
      if (e.key === 'ArrowDown')  dy =  nudge;
      if ((dx !== 0 || dy !== 0) && store.selectedNodeIds.size > 0) {
        store.pushUndo();
        useCanvasStore.setState((s) => ({
          nodes: s.nodes.map((n) =>
            s.selectedNodeIds.has(n.id) && !n.locked
              ? { ...n, x: n.x + dx, y: n.y + dy }
              : n,
          ),
          isDirty: true,
        }));
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setShowSearch]);

  // Wheel handler for zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const oldZoom = viewport.zoom;
      const newZoom = Math.max(0.25, Math.min(4, oldZoom * factor));

      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = mx / oldZoom - viewport.x;
      const wy = my / oldZoom - viewport.y;
      const newX = mx / newZoom - wx;
      const newY = my / newZoom - wy;

      setViewport({ x: newX, y: newY, zoom: newZoom });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewport, setViewport, containerRef]);

  return { spaceDown };
}
