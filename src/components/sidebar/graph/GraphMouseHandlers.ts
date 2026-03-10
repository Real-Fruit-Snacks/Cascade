import { type GraphNode } from './GraphTypes';

export interface MouseHandlerRefs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  nodesRef: React.RefObject<GraphNode[]>;
  nodeBaseSizeRef: React.RefObject<number>;
  offsetRef: React.MutableRefObject<{ x: number; y: number }>;
  scaleRef: React.MutableRefObject<number>;
  hoveredNodeRef: React.MutableRefObject<GraphNode | null>;
  isDraggingRef: React.MutableRefObject<boolean>;
  dragStartRef: React.MutableRefObject<{ x: number; y: number }>;
  offsetStartRef: React.MutableRefObject<{ x: number; y: number }>;
  selectedPathRef: React.MutableRefObject<string | null>;
}

export function getNodeAtPos(
  canvasX: number,
  canvasY: number,
  nodes: GraphNode[],
  offset: { x: number; y: number },
  scale: number,
  nodeBaseSize: number,
): GraphNode | null {
  const wx = (canvasX - offset.x) / scale;
  const wy = (canvasY - offset.y) / scale;

  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    const r = Math.max(nodeBaseSize - 2, Math.min(nodeBaseSize + 2, nodeBaseSize + node.connectionCount * 0.8)) + 4;
    const dx = wx - node.x;
    const dy = wy - node.y;
    if (dx * dx + dy * dy <= r * r) return node;
  }
  return null;
}

export function handleMouseMove(
  e: React.MouseEvent<HTMLCanvasElement>,
  refs: MouseHandlerRefs,
  draw: () => void,
): void {
  const canvas = refs.canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  if (refs.isDraggingRef.current) {
    refs.offsetRef.current = {
      x: refs.offsetStartRef.current.x + (e.clientX - refs.dragStartRef.current.x),
      y: refs.offsetStartRef.current.y + (e.clientY - refs.dragStartRef.current.y),
    };
    draw();
    return;
  }

  const node = getNodeAtPos(cx, cy, refs.nodesRef.current, refs.offsetRef.current, refs.scaleRef.current, refs.nodeBaseSizeRef.current);
  if (node !== refs.hoveredNodeRef.current) {
    refs.hoveredNodeRef.current = node;
    canvas.style.cursor = node ? 'pointer' : 'grab';
    draw();
  }
}

export function handleMouseDown(
  e: React.MouseEvent<HTMLCanvasElement>,
  refs: MouseHandlerRefs,
): void {
  const canvas = refs.canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const node = getNodeAtPos(cx, cy, refs.nodesRef.current, refs.offsetRef.current, refs.scaleRef.current, refs.nodeBaseSizeRef.current);

  if (!node) {
    refs.isDraggingRef.current = true;
    refs.dragStartRef.current = { x: e.clientX, y: e.clientY };
    refs.offsetStartRef.current = { ...refs.offsetRef.current };
    canvas.style.cursor = 'grabbing';
  }
}

export function handleMouseUp(
  e: React.MouseEvent<HTMLCanvasElement>,
  refs: MouseHandlerRefs,
  draw: () => void,
  vaultPath: string | null,
  openFile: (vaultPath: string, filePath: string, focus: boolean, preview: boolean) => void,
): void {
  const canvas = refs.canvasRef.current;
  if (!canvas) return;

  if (refs.isDraggingRef.current) {
    refs.isDraggingRef.current = false;
    canvas.style.cursor = 'grab';
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const node = getNodeAtPos(cx, cy, refs.nodesRef.current, refs.offsetRef.current, refs.scaleRef.current, refs.nodeBaseSizeRef.current);
  if (node && vaultPath) {
    refs.selectedPathRef.current = node.filePath;
    openFile(vaultPath, node.filePath, true, true);
    draw();
  }
}

export function handleWheel(
  e: React.WheelEvent<HTMLCanvasElement>,
  refs: Pick<MouseHandlerRefs, 'canvasRef' | 'offsetRef' | 'scaleRef'>,
  draw: () => void,
): void {
  e.preventDefault();
  const canvas = refs.canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const newScale = Math.min(3, Math.max(0.3, refs.scaleRef.current * zoomFactor));

  refs.offsetRef.current = {
    x: mouseX - (mouseX - refs.offsetRef.current.x) * (newScale / refs.scaleRef.current),
    y: mouseY - (mouseY - refs.offsetRef.current.y) * (newScale / refs.scaleRef.current),
  };
  refs.scaleRef.current = newScale;
  draw();
}
