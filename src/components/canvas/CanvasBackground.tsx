import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import type { EdgeSide, CanvasColor } from '../../types/canvas';
import { CANVAS_COLORS } from '../../types/canvas';

export interface ConnectDragState {
  fromNodeId: string;
  fromSide: EdgeSide;
  startX: number; // screen coords
  startY: number;
  currentX: number;
  currentY: number;
}

interface CanvasBackgroundProps {
  width: number;
  height: number;
  connectDrag?: ConnectDragState | null;
}

// Resolve a CSS var string like "var(--ctp-red)" to its computed color value
function resolveCssVar(cssVar: string): string {
  const match = cssVar.match(/var\((--[^)]+)\)/);
  if (!match) return cssVar;
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
}

function resolveEdgeColor(color: CanvasColor | undefined): string {
  if (color !== undefined) {
    const cssVar = CANVAS_COLORS[color];
    if (cssVar) {
      const resolved = resolveCssVar(cssVar);
      if (resolved) return resolved;
    }
  }
  return getComputedStyle(document.documentElement).getPropertyValue('--ctp-overlay0').trim() || '#6c7086';
}

// Compute the anchor point (world coords) for a given side on a node
function anchorPoint(
  node: { x: number; y: number; width: number; height: number },
  side: EdgeSide,
): { x: number; y: number } {
  switch (side) {
    case 'top':    return { x: node.x + node.width / 2, y: node.y };
    case 'bottom': return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':   return { x: node.x, y: node.y + node.height / 2 };
    case 'right':  return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}

// Control point offset direction per side (outward from the node)
function sideDirection(side: EdgeSide): { dx: number; dy: number } {
  switch (side) {
    case 'top':    return { dx: 0, dy: -1 };
    case 'bottom': return { dx: 0, dy: 1 };
    case 'left':   return { dx: -1, dy: 0 };
    case 'right':  return { dx: 1, dy: 0 };
  }
}

// Draw an arrowhead at (tx, ty) pointing in direction (dx, dy) — normalised
function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  size: number,
) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const ux = dx / len;
  const uy = dy / len;

  // Perpendicular
  const px = -uy;
  const py = ux;

  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - ux * size + px * size * 0.45, ty - uy * size + py * size * 0.45);
  ctx.lineTo(tx - ux * size - px * size * 0.45, ty - uy * size - py * size * 0.45);
  ctx.closePath();
  ctx.fill();
}

export function CanvasBackground({ width, height, connectDrag }: CanvasBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewport = useCanvasStore((s) => s.viewport);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const { x, y, zoom } = viewport;

    // ── Grid dots ────────────────────────────────────────────────────────────
    const gridSize = 20 * zoom;
    if (gridSize >= 5) {
      const dotColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--ctp-surface1')
        .trim() || '#45475a';

      ctx.fillStyle = dotColor;
      const dotRadius = Math.max(1, zoom * 1.2);
      const offsetX = ((x * zoom) % gridSize + gridSize) % gridSize;
      const offsetY = ((y * zoom) % gridSize + gridSize) % gridSize;

      for (let px = offsetX; px < width; px += gridSize) {
        for (let py = offsetY; py < height; py += gridSize) {
          ctx.beginPath();
          ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ── Helper: world → screen ───────────────────────────────────────────────
    const toScreen = (wx: number, wy: number) => ({
      sx: (wx + x) * zoom,
      sy: (wy + y) * zoom,
    });

    // ── Edges ────────────────────────────────────────────────────────────────
    const CTRL_OFFSET = 80; // world-space pixels

    for (const edge of edges) {
      const fromNode = nodes.find((n) => n.id === edge.fromNode);
      const toNode = nodes.find((n) => n.id === edge.toNode);
      if (!fromNode || !toNode) continue;

      const fromAnchorW = anchorPoint(fromNode, edge.fromSide);
      const toAnchorW = anchorPoint(toNode, edge.toSide);

      const from = toScreen(fromAnchorW.x, fromAnchorW.y);
      const to = toScreen(toAnchorW.x, toAnchorW.y);

      const fromDir = sideDirection(edge.fromSide);
      const toDir = sideDirection(edge.toSide);

      const offset = CTRL_OFFSET * zoom;
      const cp1x = from.sx + fromDir.dx * offset;
      const cp1y = from.sy + fromDir.dy * offset;
      const cp2x = to.sx + toDir.dx * offset;
      const cp2y = to.sy + toDir.dy * offset;

      const isSelected = selectedEdgeIds.has(edge.id);
      const color = isSelected
        ? (getComputedStyle(document.documentElement).getPropertyValue('--ctp-blue').trim() || '#89b4fa')
        : resolveEdgeColor(edge.color);

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = isSelected ? 3 * zoom : 2 * zoom;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(from.sx, from.sy);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.sx, to.sy);
      ctx.stroke();

      // Arrowhead — direction = tangent at end point (cp2 → to)
      const arrowSize = (isSelected ? 10 : 8) * zoom;
      drawArrowhead(
        ctx,
        to.sx,
        to.sy,
        to.sx - cp2x,
        to.sy - cp2y,
        arrowSize,
      );

      // Label at bezier midpoint (t=0.5)
      if (edge.label) {
        const t = 0.5;
        const mt = 1 - t;
        const labelX =
          mt * mt * mt * from.sx +
          3 * mt * mt * t * cp1x +
          3 * mt * t * t * cp2x +
          t * t * t * to.sx;
        const labelY =
          mt * mt * mt * from.sy +
          3 * mt * mt * t * cp1y +
          3 * mt * t * t * cp2y +
          t * t * t * to.sy;

        const fontSize = Math.max(10, 12 * zoom);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Background pill for readability
        const metrics = ctx.measureText(edge.label);
        const pad = 4 * zoom;
        const bg = getComputedStyle(document.documentElement)
          .getPropertyValue('--ctp-base')
          .trim() || '#1e1e2e';
        ctx.fillStyle = bg;
        ctx.fillRect(
          labelX - metrics.width / 2 - pad,
          labelY - fontSize / 2 - pad,
          metrics.width + pad * 2,
          fontSize + pad * 2,
        );

        ctx.fillStyle = color;
        ctx.fillText(edge.label, labelX, labelY);
      }
    }

    // ── Temporary connection line during connect drag ─────────────────────
    if (connectDrag) {
      const fromNode = nodes.find((n) => n.id === connectDrag.fromNodeId);
      if (fromNode) {
        const fromAnchorW = anchorPoint(fromNode, connectDrag.fromSide);
        const from = toScreen(fromAnchorW.x, fromAnchorW.y);
        const fromDir = sideDirection(connectDrag.fromSide);

        const offset = CTRL_OFFSET * zoom;
        const cp1x = from.sx + fromDir.dx * offset;
        const cp1y = from.sy + fromDir.dy * offset;

        // Control point 2: bias toward the mouse
        const dx = connectDrag.currentX - from.sx;
        const dy = connectDrag.currentY - from.sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const cp2x = connectDrag.currentX - (dx / (dist || 1)) * Math.min(offset, dist * 0.5);
        const cp2y = connectDrag.currentY - (dy / (dist || 1)) * Math.min(offset, dist * 0.5);

        const accentColor =
          getComputedStyle(document.documentElement).getPropertyValue('--ctp-blue').trim() ||
          '#89b4fa';

        ctx.strokeStyle = accentColor;
        ctx.fillStyle = accentColor;
        ctx.lineWidth = 2 * zoom;
        ctx.lineCap = 'round';
        ctx.setLineDash([6, 4]);

        ctx.beginPath();
        ctx.moveTo(from.sx, from.sy);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, connectDrag.currentX, connectDrag.currentY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small dot at cursor
        ctx.beginPath();
        ctx.arc(connectDrag.currentX, connectDrag.currentY, 4 * zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [width, height, viewport, nodes, edges, selectedEdgeIds, connectDrag]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  );
}
