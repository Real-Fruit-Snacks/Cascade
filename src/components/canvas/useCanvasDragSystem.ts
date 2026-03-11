import { useRef, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { useSettingsStore } from '../../stores/settings-store';
import type { EdgeSide, TextNode, CanvasNode } from '../../types/canvas';
import type { ConnectDragState, MarqueeDragState } from './CanvasBackground';
import type { ResizeCorner } from './CanvasCards';
import { anchorPoint, sideDirection, isNearBezier, closestSide } from './canvas-utils';
import type { DragRef, DragMode, ContextMenuState } from './canvas-types';
import { MIN_CARD_W, MIN_CARD_H, EDGE_HIT_RADIUS, CTRL_OFFSET, DEFAULT_GRID_SIZE } from './canvas-types';

interface UseCanvasDragSystemOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  spaceDown: React.RefObject<boolean>;
}

export function useCanvasDragSystem({ containerRef, spaceDown }: UseCanvasDragSystemOptions) {
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const canvasLocked = useCanvasStore((s) => s.canvasLocked);
  const canvasTool = useCanvasStore((s) => s.canvasTool);

  const canvasSnapToGrid = useSettingsStore((s) => s.canvasSnapToGrid);
  const canvasGridSize = useSettingsStore((s) => s.canvasGridSize);
  const GRID_SIZE = canvasGridSize || DEFAULT_GRID_SIZE;

  const dragRef = useRef<DragRef>({ mode: 'none' });
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [connectDrag, setConnectDrag] = useState<ConnectDragState | null>(null);
  const [marqueeDrag, setMarqueeDrag] = useState<MarqueeDragState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const onCardMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

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

    for (const node of nodes) {
      if (!selectedIds.has(node.id) || node.type !== 'group') continue;
      for (const other of nodes) {
        if (other.type === 'group') continue;
        if (origPositions.has(other.id)) continue;
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
      const rect = containerRef.current?.getBoundingClientRect();
      const sx = rect ? e.clientX - rect.left : e.clientX;
      const sy = rect ? e.clientY - rect.top : e.clientY;
      const edgeId = hitTestEdge(sx, sy);
      if (edgeId) {
        useCanvasStore.getState().selectEdge(edgeId);
      } else {
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
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? e.clientX - rect.left : e.clientX;
      const cy = rect ? e.clientY - rect.top : e.clientY;

      const { nodes, viewport: vp } = useCanvasStore.getState();

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
      const minX = Math.min(drag.startWX, drag.currentWX);
      const minY = Math.min(drag.startWY, drag.currentWY);
      const maxX = Math.max(drag.startWX, drag.currentWX);
      const maxY = Math.max(drag.startWY, drag.currentWY);

      const MIN_MARQUEE = 4;
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

    const edgeId = hitTestEdge(sx, sy);

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

  return {
    dragMode,
    connectDrag,
    marqueeDrag,
    contextMenu,
    setContextMenu,
    onCardMouseDown,
    onResizeMouseDown,
    onConnectMouseDown,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleDoubleClick,
    handleContextMenu,
    onCardContextMenu,
    handleDragOver,
    handleDrop,
    cursor,
  };
}
