import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { readFile, writeFile } from '../../lib/tauri-commands';
import type { CanvasData } from '../../types/canvas';
import { CanvasBackground } from './CanvasBackground';
import { CanvasCards, type ResizeCorner } from './CanvasCards';

interface CanvasViewProps {
  filePath: string;
  vaultPath: string;
}

type DragMode = 'none' | 'pan' | 'move' | 'resize';

interface MoveDragRef {
  mode: 'move';
  startX: number;
  startY: number;
  origPositions: Map<string, { x: number; y: number }>;
}

interface ResizeDragRef {
  mode: 'resize';
  nodeId: string;
  corner: ResizeCorner;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

interface PanDragRef {
  mode: 'pan';
  startX: number;
  startY: number;
  vpX: number;
  vpY: number;
}

interface NoDragRef {
  mode: 'none';
}

type DragRef = NoDragRef | PanDragRef | MoveDragRef | ResizeDragRef;

const MIN_CARD_W = 100;
const MIN_CARD_H = 60;

export function CanvasView({ filePath, vaultPath }: CanvasViewProps) {
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const isDirty = useCanvasStore((s) => s.isDirty);
  const markClean = useCanvasStore((s) => s.markClean);
  const toJSON = useCanvasStore((s) => s.toJSON);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const clearSelection = useCanvasStore((s) => s.clearSelection);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Unified drag state ref — avoids React re-renders during drag
  const dragRef = useRef<DragRef>({ mode: 'none' });

  // Track current drag mode for cursor styling — use a state-driven boolean
  const [dragMode, setDragMode] = useState<DragMode>('none');

  const spaceDown = useRef(false);

  // Load canvas on mount / filePath change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      let data: CanvasData = { nodes: [], edges: [] };
      try {
        const raw = await readFile(vaultPath, filePath);
        if (raw && raw.trim().length > 0) {
          try {
            data = JSON.parse(raw) as CanvasData;
            if (!Array.isArray(data.nodes)) data.nodes = [];
            if (!Array.isArray(data.edges)) data.edges = [];
          } catch {
            data = { nodes: [], edges: [] };
          }
        }
      } catch {
        // File missing or unreadable — start empty
        data = { nodes: [], edges: [] };
      }

      if (!cancelled) {
        loadCanvas(filePath, data);
      }
    }

    load();

    return () => {
      cancelled = true;
      clearCanvas();
    };
  }, [filePath, vaultPath, loadCanvas, clearCanvas]);

  // Auto-save when dirty, debounced 1 second
  useEffect(() => {
    if (!isDirty) return;

    const timer = setTimeout(async () => {
      const data = toJSON();
      try {
        await writeFile(vaultPath, filePath, JSON.stringify(data, null, 2));
        markClean();
      } catch (err) {
        console.error('[CanvasView] save failed:', err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isDirty, filePath, vaultPath, toJSON, markClean]);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Space key tracking
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        spaceDown.current = true;
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
  }, []);

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
  }, [viewport, setViewport]);

  // Card drag initiated from a card's mousedown
  const onCardMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const store = useCanvasStore.getState();

    // If card not selected, select it (non-additive) first
    if (!store.selectedNodeIds.has(nodeId)) {
      store.selectNode(nodeId, false);
    }

    // Push undo once at drag start
    store.pushUndo();

    // Snapshot original positions of all currently selected nodes
    // Re-read selection after potential selectNode call above
    const selectedIds = useCanvasStore.getState().selectedNodeIds;
    const nodes = useCanvasStore.getState().nodes;
    const origPositions = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      if (selectedIds.has(node.id)) {
        origPositions.set(node.id, { x: node.x, y: node.y });
      }
    }

    dragRef.current = {
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origPositions,
    };
    setDragMode('move');
  };

  // Resize initiated from a resize handle's mousedown
  const onResizeMouseDown = (nodeId: string, corner: ResizeCorner, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const store = useCanvasStore.getState();
    const node = store.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Push undo once at resize start
    store.pushUndo();

    dragRef.current = {
      mode: 'resize',
      nodeId,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      origX: node.x,
      origY: node.y,
      origW: node.width,
      origH: node.height,
    };
    setDragMode('resize');
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const isMiddle = e.button === 1;
    const isLeftWithSpace = e.button === 0 && spaceDown.current;

    if (isMiddle || isLeftWithSpace) {
      dragRef.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        vpX: viewport.x,
        vpY: viewport.y,
      };
      setDragMode('pan');
      e.preventDefault();
      return;
    }

    // Click on empty canvas (the container itself) clears selection
    if (e.button === 0 && e.target === e.currentTarget) {
      clearSelection();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (drag.mode === 'pan') {
      const dx = (e.clientX - drag.startX) / viewport.zoom;
      const dy = (e.clientY - drag.startY) / viewport.zoom;
      setViewport({
        x: drag.vpX + dx,
        y: drag.vpY + dy,
      });
      return;
    }

    if (drag.mode === 'move') {
      const zoom = useCanvasStore.getState().viewport.zoom;
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;

      // Directly update node positions without calling updateNode (which pushes undo)
      useCanvasStore.setState((s) => ({
        nodes: s.nodes.map((n) => {
          const orig = drag.origPositions.get(n.id);
          if (!orig) return n;
          return { ...n, x: orig.x + dx, y: orig.y + dy };
        }),
        isDirty: true,
      }));
      return;
    }

    if (drag.mode === 'resize') {
      const zoom = useCanvasStore.getState().viewport.zoom;
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;

      let newX = drag.origX;
      let newY = drag.origY;
      let newW = drag.origW;
      let newH = drag.origH;

      switch (drag.corner) {
        case 'br':
          newW = Math.max(MIN_CARD_W, drag.origW + dx);
          newH = Math.max(MIN_CARD_H, drag.origH + dy);
          break;
        case 'bl':
          newW = Math.max(MIN_CARD_W, drag.origW - dx);
          newH = Math.max(MIN_CARD_H, drag.origH + dy);
          newX = drag.origX + drag.origW - newW;
          break;
        case 'tr':
          newW = Math.max(MIN_CARD_W, drag.origW + dx);
          newH = Math.max(MIN_CARD_H, drag.origH - dy);
          newY = drag.origY + drag.origH - newH;
          break;
        case 'tl':
          newW = Math.max(MIN_CARD_W, drag.origW - dx);
          newH = Math.max(MIN_CARD_H, drag.origH - dy);
          newX = drag.origX + drag.origW - newW;
          newY = drag.origY + drag.origH - newH;
          break;
      }

      useCanvasStore.setState((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === drag.nodeId
            ? { ...n, x: newX, y: newY, width: newW, height: newH }
            : n
        ),
        isDirty: true,
      }));
      return;
    }
  };

  const handleMouseUp = () => {
    dragRef.current = { mode: 'none' };
    setDragMode('none');
  };

  const cursor =
    dragMode === 'pan' || spaceDown.current
      ? 'grab'
      : dragMode === 'move'
      ? 'grabbing'
      : undefined;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: 'var(--ctp-base)', cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {containerSize.width > 0 && (
        <CanvasBackground width={containerSize.width} height={containerSize.height} />
      )}
      <CanvasCards
        vaultPath={vaultPath}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        onCardMouseDown={onCardMouseDown}
        onResizeMouseDown={onResizeMouseDown}
      />
    </div>
  );
}
