import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { readFile, writeFile } from '../../lib/tauri-commands';
import type { CanvasData, EdgeSide, CanvasNode } from '../../types/canvas';
import { CanvasBackground, type ConnectDragState } from './CanvasBackground';
import { CanvasCards, type ResizeCorner } from './CanvasCards';

interface CanvasViewProps {
  filePath: string;
  vaultPath: string;
}

type DragMode = 'none' | 'pan' | 'move' | 'resize' | 'connect';

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

interface ConnectDragRef {
  mode: 'connect';
  fromNodeId: string;
  fromSide: EdgeSide;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface NoDragRef {
  mode: 'none';
}

type DragRef = NoDragRef | PanDragRef | MoveDragRef | ResizeDragRef | ConnectDragRef;

const MIN_CARD_W = 100;
const MIN_CARD_H = 60;
const EDGE_HIT_RADIUS = 8;
const BEZIER_SAMPLE_COUNT = 30;
const CTRL_OFFSET = 80; // world-space pixels, must match CanvasBackground

// Anchor point in world coords
function anchorPoint(
  node: CanvasNode,
  side: EdgeSide,
): { x: number; y: number } {
  switch (side) {
    case 'top':    return { x: node.x + node.width / 2, y: node.y };
    case 'bottom': return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':   return { x: node.x, y: node.y + node.height / 2 };
    case 'right':  return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}

function sideDirection(side: EdgeSide): { dx: number; dy: number } {
  switch (side) {
    case 'top':    return { dx: 0, dy: -1 };
    case 'bottom': return { dx: 0, dy: 1 };
    case 'left':   return { dx: -1, dy: 0 };
    case 'right':  return { dx: 1, dy: 0 };
  }
}

// Sample a cubic bezier at t in [0,1]
function bezierPoint(
  p0x: number, p0y: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  p1x: number, p1y: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * p1x,
    y: mt * mt * mt * p0y + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * p1y,
  };
}

// Check if screen point (mx, my) is within hitRadius of a bezier edge (all in screen coords)
function isNearBezier(
  mx: number, my: number,
  p0x: number, p0y: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  p1x: number, p1y: number,
  hitRadius: number,
): boolean {
  for (let i = 0; i <= BEZIER_SAMPLE_COUNT; i++) {
    const t = i / BEZIER_SAMPLE_COUNT;
    const pt = bezierPoint(p0x, p0y, cp1x, cp1y, cp2x, cp2y, p1x, p1y, t);
    const dx = mx - pt.x;
    const dy = my - pt.y;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return true;
  }
  return false;
}

// Determine which side of a node a screen point is closest to
function closestSide(node: CanvasNode, wx: number, wy: number): EdgeSide {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = wx - cx;
  const dy = wy - cy;

  // Normalise by half-extents to determine dominant axis
  const nx = dx / (node.width / 2);
  const ny = dy / (node.height / 2);

  if (Math.abs(nx) >= Math.abs(ny)) {
    return nx >= 0 ? 'right' : 'left';
  } else {
    return ny >= 0 ? 'bottom' : 'top';
  }
}

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

  // Track current drag mode for cursor styling
  const [dragMode, setDragMode] = useState<DragMode>('none');

  // Connect drag state for live canvas preview — updated via setState so canvas redraws
  const [connectDrag, setConnectDrag] = useState<ConnectDragState | null>(null);

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

  // Space key tracking + Delete/Backspace for selected edges
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        spaceDown.current = true;
        e.preventDefault();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === document.body) {
        const store = useCanvasStore.getState();
        if (store.selectedEdgeIds.size > 0) {
          store.removeEdges([...store.selectedEdgeIds]);
          e.preventDefault();
        }
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

    if (!store.selectedNodeIds.has(nodeId)) {
      store.selectNode(nodeId, false);
    }

    store.pushUndo();

    const selectedIds = useCanvasStore.getState().selectedNodeIds;
    const nodes = useCanvasStore.getState().nodes;
    const origPositions = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      if (selectedIds.has(node.id)) {
        origPositions.set(node.id, { x: node.x, y: node.y });
      }
    }

    // For each selected group, also snapshot child nodes (non-group nodes whose
    // center falls within the group bounds) so they move together.
    for (const node of nodes) {
      if (!selectedIds.has(node.id) || node.type !== 'group') continue;
      for (const other of nodes) {
        if (other.type === 'group') continue;
        if (origPositions.has(other.id)) continue; // already included (selected)
        const cx = other.x + other.width / 2;
        const cy = other.y + other.height / 2;
        if (cx >= node.x && cx <= node.x + node.width &&
            cy >= node.y && cy <= node.y + node.height) {
          origPositions.set(other.id, { x: other.x, y: other.y });
        }
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

  // Connection handle mousedown — start drawing a new edge
  const onConnectMouseDown = (nodeId: string, side: EdgeSide, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const rect = containerRef.current?.getBoundingClientRect();
    const sx = rect ? e.clientX - rect.left : e.clientX;
    const sy = rect ? e.clientY - rect.top : e.clientY;

    dragRef.current = {
      mode: 'connect',
      fromNodeId: nodeId,
      fromSide: side,
      startX: sx,
      startY: sy,
      currentX: sx,
      currentY: sy,
    };
    setDragMode('connect');
    setConnectDrag({
      fromNodeId: nodeId,
      fromSide: side,
      startX: sx,
      startY: sy,
      currentX: sx,
      currentY: sy,
    });
  };

  // Hit-test edges in screen space — returns the id of the first edge within EDGE_HIT_RADIUS
  const hitTestEdge = (screenX: number, screenY: number): string | null => {
    const { nodes, edges, viewport: vp } = useCanvasStore.getState();
    const { x, y, zoom } = vp;

    const toScreen = (wx: number, wy: number) => ({
      sx: (wx + x) * zoom,
      sy: (wy + y) * zoom,
    });

    for (const edge of edges) {
      const fromNode = nodes.find((n) => n.id === edge.fromNode);
      const toNode = nodes.find((n) => n.id === edge.toNode);
      if (!fromNode || !toNode) continue;

      const fromW = anchorPoint(fromNode, edge.fromSide);
      const toW = anchorPoint(toNode, edge.toSide);
      const from = toScreen(fromW.x, fromW.y);
      const to = toScreen(toW.x, toW.y);

      const fromDir = sideDirection(edge.fromSide);
      const toDir = sideDirection(edge.toSide);
      const offset = CTRL_OFFSET * zoom;

      if (
        isNearBezier(
          screenX, screenY,
          from.sx, from.sy,
          from.sx + fromDir.dx * offset, from.sy + fromDir.dy * offset,
          to.sx + toDir.dx * offset, to.sy + toDir.dy * offset,
          to.sx, to.sy,
          EDGE_HIT_RADIUS,
        )
      ) {
        return edge.id;
      }
    }
    return null;
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

    if (e.button === 0 && e.target === e.currentTarget) {
      // Check if click is near an edge before clearing selection
      const rect = containerRef.current?.getBoundingClientRect();
      const sx = rect ? e.clientX - rect.left : e.clientX;
      const sy = rect ? e.clientY - rect.top : e.clientY;
      const edgeId = hitTestEdge(sx, sy);
      if (edgeId) {
        useCanvasStore.getState().selectEdge(edgeId);
      } else {
        clearSelection();
      }
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

    if (drag.mode === 'connect') {
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? e.clientX - rect.left : e.clientX;
      const cy = rect ? e.clientY - rect.top : e.clientY;
      drag.currentX = cx;
      drag.currentY = cy;
      setConnectDrag({
        fromNodeId: drag.fromNodeId,
        fromSide: drag.fromSide,
        startX: drag.startX,
        startY: drag.startY,
        currentX: cx,
        currentY: cy,
      });
      return;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (drag.mode === 'connect') {
      // Find which node (if any) the mouse is over
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? e.clientX - rect.left : e.clientX;
      const cy = rect ? e.clientY - rect.top : e.clientY;

      const { nodes, viewport: vp } = useCanvasStore.getState();

      // Convert screen coords back to world coords
      const wx = cx / vp.zoom - vp.x;
      const wy = cy / vp.zoom - vp.y;

      const targetNode = nodes.find(
        (n) =>
          n.id !== drag.fromNodeId &&
          n.type !== 'group' &&
          wx >= n.x && wx <= n.x + n.width &&
          wy >= n.y && wy <= n.y + n.height,
      );

      if (targetNode) {
        const toSide = closestSide(targetNode, wx, wy);
        useCanvasStore.getState().addEdge({
          fromNode: drag.fromNodeId,
          fromSide: drag.fromSide,
          toNode: targetNode.id,
          toSide,
        });
      }

      setConnectDrag(null);
    }

    dragRef.current = { mode: 'none' };
    setDragMode('none');
  };

  const handleMouseLeave = () => {
    if (dragRef.current.mode === 'connect') {
      setConnectDrag(null);
    }
    dragRef.current = { mode: 'none' };
    setDragMode('none');
  };

  const cursor =
    dragMode === 'pan' || spaceDown.current
      ? 'grab'
      : dragMode === 'move'
      ? 'grabbing'
      : dragMode === 'connect'
      ? 'crosshair'
      : undefined;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: 'var(--ctp-base)', cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {containerSize.width > 0 && (
        <CanvasBackground
          width={containerSize.width}
          height={containerSize.height}
          connectDrag={connectDrag}
        />
      )}
      <CanvasCards
        vaultPath={vaultPath}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        onCardMouseDown={onCardMouseDown}
        onResizeMouseDown={onResizeMouseDown}
        onConnectMouseDown={onConnectMouseDown}
      />
    </div>
  );
}
