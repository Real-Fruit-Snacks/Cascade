import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { readFile, writeFile } from '../../lib/tauri-commands';
import type { CanvasData, CanvasEdge, EdgeSide, CanvasNode, TextNode } from '../../types/canvas';
import { CanvasBackground, type ConnectDragState, type MarqueeDragState } from './CanvasBackground';
import { CanvasCards, type ResizeCorner } from './CanvasCards';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasInputModal } from './CanvasInputModal';
import { CanvasContextMenu } from './CanvasContextMenu';
import { CanvasSearch } from './CanvasSearch';
import { CanvasMinimap } from './CanvasMinimap';
import { anchorPoint, sideDirection } from './canvas-utils';
import { gridLayout, treeLayout, forceLayout } from './CanvasAutoLayout';
import { useSettingsStore } from '../../stores/settings-store';

interface CanvasViewProps {
  filePath: string;
  vaultPath: string;
}

type DragMode = 'none' | 'pan' | 'move' | 'resize' | 'connect' | 'marquee';

interface MoveDragRef {
  mode: 'move';
  startX: number;
  startY: number;
  origPositions: Map<string, { x: number; y: number }>;
  undoPushed: boolean;
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

interface MarqueeDragRef {
  mode: 'marquee';
  // World coordinates of the marquee rectangle corners
  startWX: number;
  startWY: number;
  currentWX: number;
  currentWY: number;
  additive: boolean;
}

type DragRef = NoDragRef | PanDragRef | MoveDragRef | ResizeDragRef | ConnectDragRef | MarqueeDragRef;

const MIN_CARD_W = 100;
const MIN_CARD_H = 60;
const EDGE_HIT_RADIUS = 8;
const BEZIER_SAMPLE_COUNT = 30;
const CTRL_OFFSET = 80; // world-space pixels, must match CanvasBackground
const DEFAULT_GRID_SIZE = 20;

// Clipboard helpers using the system clipboard
interface ClipboardData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

async function writeCanvasClipboard(data: ClipboardData): Promise<void> {
  try {
    await navigator.clipboard.writeText(JSON.stringify({ __cascadeCanvas: true, ...data }));
  } catch { /* clipboard access denied — ignore */ }
}

async function readCanvasClipboard(): Promise<ClipboardData | null> {
  try {
    const raw = await navigator.clipboard.readText();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.__cascadeCanvas && Array.isArray(parsed.nodes)) return parsed;
  } catch { /* not canvas data or clipboard access denied */ }
  return null;
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
  const canvasLocked = useCanvasStore((s) => s.canvasLocked);
  const canvasTool = useCanvasStore((s) => s.canvasTool);

  const canvasSnapToGrid = useSettingsStore((s) => s.canvasSnapToGrid);
  const canvasGridSize = useSettingsStore((s) => s.canvasGridSize);
  const canvasShowMinimap = useSettingsStore((s) => s.canvasShowMinimap);
  const GRID_SIZE = canvasGridSize || DEFAULT_GRID_SIZE;

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Unified drag state ref — avoids React re-renders during drag
  const dragRef = useRef<DragRef>({ mode: 'none' });

  // Track current drag mode for cursor styling
  const [dragMode, setDragMode] = useState<DragMode>('none');

  // Connect drag state for live canvas preview — updated via setState so canvas redraws
  const [connectDrag, setConnectDrag] = useState<ConnectDragState | null>(null);

  // Marquee selection drag state — updated via setState so canvas redraws
  const [marqueeDrag, setMarqueeDrag] = useState<MarqueeDragState | null>(null);

  // Context menu state
  interface ContextMenuState {
    x: number;
    y: number;
    targetNodeId?: string;
    targetEdgeId?: string;
    worldX: number;
    worldY: number;
  }
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [inputModal, setInputModal] = useState<{ title: string; defaultValue?: string; onSubmit: (v: string) => void } | null>(null);

  const requestInput = useCallback((title: string, defaultValue?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setInputModal({
        title,
        defaultValue,
        onSubmit: (v) => { setInputModal(null); resolve(v); },
      });
    });
  }, []);

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
        // Apply auto-layout if configured
        const autoLayout = useSettingsStore.getState().canvasAutoLayout;
        if (autoLayout && autoLayout !== 'none' && data.nodes.length > 0) {
          const store = useCanvasStore.getState();
          const layoutFn = autoLayout === 'grid' ? gridLayout
            : autoLayout === 'tree' ? treeLayout
            : autoLayout === 'force' ? forceLayout
            : null;
          if (layoutFn) {
            store.applyLayout((nodes, edges) => layoutFn(nodes, edges));
            store.zoomToFit();
          }
        }
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
        useCanvasStore.getState().setContainerSize({ width, height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

      // When canvas is locked, only allow navigation (zoom, select, pan) — block mutations
      if (store.canvasLocked) {
        // Allow: Ctrl+A (select all), zoom shortcuts, Escape
        if (e.key === 'Escape') { store.clearSelection(); return; }
        if (ctrl && e.key === 'a') { store.selectAll(); e.preventDefault(); return; }
        return; // Block everything else (delete, paste, cut, undo, redo)
      }

      // Delete / Backspace — remove selected nodes and edges
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

      // Ctrl+A — select all
      if (ctrl && e.key === 'a') {
        store.selectAll();
        e.preventDefault();
        return;
      }

      // Ctrl+Z — undo
      if (ctrl && !e.shiftKey && e.key === 'z') {
        store.undo();
        e.preventDefault();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z — redo
      if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
        store.redo();
        e.preventDefault();
        return;
      }

      // Ctrl+C — copy selected nodes (and internal edges) to system clipboard
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

      // Ctrl+V — paste clipboard nodes offset by (20, 20), with new IDs
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

      // Ctrl+D — duplicate selected nodes
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

      // Ctrl+F — open canvas search
      if (ctrl && e.key === 'f') {
        setShowSearch(true);
        e.preventDefault();
        return;
      }

      // Ctrl+0 — zoom to fit
      if (ctrl && e.key === '0') {
        store.zoomToFit();
        e.preventDefault();
        return;
      }

      // Ctrl+= or Ctrl++ — zoom in (anchored to screen center)
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

      // Ctrl+- — zoom out (anchored to screen center)
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

      // Ctrl+L — toggle lock on selected nodes
      if (ctrl && e.key === 'l') {
        if (store.selectedNodeIds.size > 0) {
          store.toggleLock([...store.selectedNodeIds]);
          e.preventDefault();
        }
        return;
      }

      // Arrow keys — nudge selected nodes
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

    // Hand tool — pan regardless of what's under cursor
    if (canvasTool === 'hand') {
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

    // When locked, allow selection but not dragging
    if (canvasLocked) {
      const store = useCanvasStore.getState();
      store.selectNode(nodeId, e.ctrlKey || e.metaKey);
      return;
    }

    const store = useCanvasStore.getState();

    if (!store.selectedNodeIds.has(nodeId)) {
      store.selectNode(nodeId, false);
    }

    const selectedIds = useCanvasStore.getState().selectedNodeIds;
    const nodes = useCanvasStore.getState().nodes;
    const origPositions = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      if (selectedIds.has(node.id) && !node.locked) {
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
      undoPushed: false,
    };
    setDragMode('move');
  };

  // Resize initiated from a resize handle's mousedown
  const onResizeMouseDown = (nodeId: string, corner: ResizeCorner, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (canvasLocked) return;
    e.stopPropagation();

    const store = useCanvasStore.getState();
    const node = store.nodes.find((n) => n.id === nodeId);
    if (!node || node.locked) return;

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
    if (canvasLocked) return;
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
    const isHandTool = e.button === 0 && canvasTool === 'hand';

    if (isMiddle || isLeftWithSpace || isHandTool) {
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
        // Start marquee selection drag
        const { zoom, x, y } = viewport;
        const wx = sx / zoom - x;
        const wy = sy / zoom - y;
        const additive = e.ctrlKey || e.metaKey;
        if (!additive) {
          clearSelection();
        }
        dragRef.current = {
          mode: 'marquee',
          startWX: wx,
          startWY: wy,
          currentWX: wx,
          currentWY: wy,
          additive,
        };
        setDragMode('marquee');
        setMarqueeDrag({ startWX: wx, startWY: wy, currentWX: wx, currentWY: wy });
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

      // Push undo only once on the first actual movement
      if (!drag.undoPushed) {
        useCanvasStore.getState().pushUndo();
        drag.undoPushed = true;
      }

      useCanvasStore.setState((s) => ({
        nodes: s.nodes.map((n) => {
          const orig = drag.origPositions.get(n.id);
          if (!orig) return n;
          const rawX = orig.x + dx;
          const rawY = orig.y + dy;
          return {
            ...n,
            x: canvasSnapToGrid ? Math.round(rawX / GRID_SIZE) * GRID_SIZE : rawX,
            y: canvasSnapToGrid ? Math.round(rawY / GRID_SIZE) * GRID_SIZE : rawY,
          };
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
        case 'top':
          newH = Math.max(MIN_CARD_H, drag.origH - dy);
          newY = drag.origY + drag.origH - newH;
          break;
        case 'bottom':
          newH = Math.max(MIN_CARD_H, drag.origH + dy);
          break;
        case 'left':
          newW = Math.max(MIN_CARD_W, drag.origW - dx);
          newX = drag.origX + drag.origW - newW;
          break;
        case 'right':
          newW = Math.max(MIN_CARD_W, drag.origW + dx);
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

    if (drag.mode === 'marquee') {
      const rect = containerRef.current?.getBoundingClientRect();
      const sx = rect ? e.clientX - rect.left : e.clientX;
      const sy = rect ? e.clientY - rect.top : e.clientY;
      const { zoom, x, y } = useCanvasStore.getState().viewport;
      const wx = sx / zoom - x;
      const wy = sy / zoom - y;
      drag.currentWX = wx;
      drag.currentWY = wy;
      setMarqueeDrag({ startWX: drag.startWX, startWY: drag.startWY, currentWX: wx, currentWY: wy });
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

    if (drag.mode === 'marquee') {
      // Compute the bounding rectangle in world coords
      const minX = Math.min(drag.startWX, drag.currentWX);
      const minY = Math.min(drag.startWY, drag.currentWY);
      const maxX = Math.max(drag.startWX, drag.currentWX);
      const maxY = Math.max(drag.startWY, drag.currentWY);

      // Only select if the rectangle has some area (avoid single-click deselect race)
      const MIN_MARQUEE = 4; // world pixels
      if (maxX - minX > MIN_MARQUEE || maxY - minY > MIN_MARQUEE) {
        const { nodes } = useCanvasStore.getState();
        const hitIds = nodes
          .filter((n) => n.type !== 'group')
          .filter(
            (n) =>
              n.x < maxX &&
              n.x + n.width > minX &&
              n.y < maxY &&
              n.y + n.height > minY,
          )
          .map((n) => n.id);
        useCanvasStore.getState().selectNodes(hitIds, drag.additive);
      }

      setMarqueeDrag(null);
    }

    dragRef.current = { mode: 'none' };
    setDragMode('none');
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only on empty canvas (direct target, not a card)
    if (e.target !== e.currentTarget) return;
    if (canvasLocked) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const sx = rect ? e.clientX - rect.left : e.clientX;
    const sy = rect ? e.clientY - rect.top : e.clientY;
    const { zoom, x, y } = viewport;
    const wx = sx / zoom - x;
    const wy = sy / zoom - y;
    useCanvasStore.getState().addNode({
      type: 'text',
      text: '',
      x: wx - 150,
      y: wy - 100,
      width: 300,
      height: 200,
    } as Omit<TextNode, 'id'>);
    // Auto-enter edit mode on the newly created node
    const newNode = useCanvasStore.getState().nodes.at(-1);
    if (newNode) {
      useCanvasStore.getState().setEditingNode(newNode.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const sx = rect ? e.clientX - rect.left : e.clientX;
    const sy = rect ? e.clientY - rect.top : e.clientY;
    const { zoom, x, y } = viewport;
    const wx = sx / zoom - x;
    const wy = sy / zoom - y;

    // Check edge hit first (before node, since edges are below cards in z-order)
    const edgeId = hitTestEdge(sx, sy);

    // Check node hit
    const { nodes } = useCanvasStore.getState();
    const hitNode = [...nodes].reverse().find(
      (n) => wx >= n.x && wx <= n.x + n.width && wy >= n.y && wy <= n.y + n.height,
    );

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetNodeId: hitNode?.id,
      targetEdgeId: hitNode ? undefined : edgeId ?? undefined,
      worldX: wx,
      worldY: wy,
    });
  };

  const onCardContextMenu = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetNodeId: nodeId,
      worldX: 0,
      worldY: 0,
    });
  };

  const handleMouseLeave = () => {
    if (dragRef.current.mode === 'connect') {
      setConnectDrag(null);
    }
    if (dragRef.current.mode === 'marquee') {
      setMarqueeDrag(null);
    }
    dragRef.current = { mode: 'none' };
    setDragMode('none');
  };

  // --- File drag-drop from sidebar ---
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('text/plain') || e.dataTransfer.types.includes('cascade/file-path')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (canvasLocked) return;
    const file = e.dataTransfer.getData('cascade/file-path') || e.dataTransfer.getData('text/plain');
    if (!file) return;
    e.preventDefault();

    const rect = containerRef.current?.getBoundingClientRect();
    const sx = rect ? e.clientX - rect.left : e.clientX;
    const sy = rect ? e.clientY - rect.top : e.clientY;
    const { zoom, x, y } = viewport;
    const wx = sx / zoom - x;
    const wy = sy / zoom - y;

    useCanvasStore.getState().addNode({
      type: 'file',
      file,
      x: wx - 150,
      y: wy - 60,
      width: 300,
      height: 120,
    } as Omit<CanvasNode, 'id'>);
  };

  const cursor =
    dragMode === 'pan'
      ? 'grabbing'
      : spaceDown.current || (canvasTool === 'hand' && dragMode === 'none')
      ? 'grab'
      : dragMode === 'move'
      ? 'grabbing'
      : dragMode === 'connect'
      ? 'crosshair'
      : undefined;

  return (
    <div
      ref={containerRef}
      data-canvas-container
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: 'var(--ctp-base)', cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {containerSize.width > 0 && (
        <CanvasBackground
          width={containerSize.width}
          height={containerSize.height}
          connectDrag={connectDrag}
          marqueeDrag={marqueeDrag}
        />
      )}
      <CanvasCards
        vaultPath={vaultPath}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        onCardMouseDown={onCardMouseDown}
        onResizeMouseDown={onResizeMouseDown}
        onConnectMouseDown={onConnectMouseDown}
        onCardContextMenu={onCardContextMenu}
      />
      <CanvasToolbar
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        requestInput={requestInput}
      />
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetNodeId={contextMenu.targetNodeId}
          targetEdgeId={contextMenu.targetEdgeId}
          worldX={contextMenu.worldX}
          worldY={contextMenu.worldY}
          vaultPath={vaultPath}
          onClose={() => setContextMenu(null)}
          requestInput={requestInput}
        />
      )}
      {showSearch && (
        <CanvasSearch onClose={() => setShowSearch(false)} />
      )}
      {inputModal && (
        <CanvasInputModal
          title={inputModal.title}
          defaultValue={inputModal.defaultValue}
          onSubmit={inputModal.onSubmit}
          onCancel={() => setInputModal(null)}
        />
      )}
      {canvasShowMinimap && containerSize.width > 0 && (
        <CanvasMinimap
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      )}
    </div>
  );
}
