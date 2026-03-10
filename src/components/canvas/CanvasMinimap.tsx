import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { resolveCssVar as resolveCssVarWrapped } from './canvas-utils';

interface CanvasMinimapProps {
  containerWidth: number;
  containerHeight: number;
}

const MINIMAP_W = 150;
const MINIMAP_H = 100;
const MINIMAP_PAD = 10;

/** Resolve a CSS custom property to its computed value. */
function resolveCssVar(varName: string): string {
  return resolveCssVarWrapped(`var(${varName})`);
}

export function CanvasMinimap({ containerWidth, containerHeight }: CanvasMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);

  // Convert a mouse position on the minimap canvas to a world coordinate and
  // update the viewport so that world point is centred on screen.
  const panToMinimapPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (nodes.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      // Recompute bounding box (same logic as draw)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + n.width > maxX) maxX = n.x + n.width;
        if (n.y + n.height > maxY) maxY = n.y + n.height;
      }

      const contentW = maxX - minX || 1;
      const contentH = maxY - minY || 1;
      const scale = Math.min(
        (MINIMAP_W - MINIMAP_PAD * 2) / contentW,
        (MINIMAP_H - MINIMAP_PAD * 2) / contentH,
      );
      const offsetX = (MINIMAP_W - contentW * scale) / 2;
      const offsetY = (MINIMAP_H - contentH * scale) / 2;

      // Map minimap pixel back to world coordinate
      const worldX = (mx - offsetX) / scale + minX;
      const worldY = (my - offsetY) / scale + minY;

      // Centre that world point on the screen
      const { zoom } = viewport;
      const newVpX = containerWidth / (2 * zoom) - worldX;
      const newVpY = containerHeight / (2 * zoom) - worldY;

      setViewport({ x: newVpX, y: newVpY });
    },
    [nodes, viewport, containerWidth, containerHeight, setViewport],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      panToMinimapPoint(e.clientX, e.clientY);
    },
    [panToMinimapPoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current) return;
      e.preventDefault();
      e.stopPropagation();
      panToMinimapPoint(e.clientX, e.clientY);
    },
    [panToMinimapPoint],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.stopPropagation();
      isDragging.current = false;
    },
    [],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.stopPropagation();
      isDragging.current = false;
    },
    [],
  );

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_W * dpr;
    canvas.height = MINIMAP_H * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

    if (nodes.length === 0) return;

    // Bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }

    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;

    // Scale to fit with padding
    const scale = Math.min(
      (MINIMAP_W - MINIMAP_PAD * 2) / contentW,
      (MINIMAP_H - MINIMAP_PAD * 2) / contentH,
    );
    const offsetX = (MINIMAP_W - contentW * scale) / 2;
    const offsetY = (MINIMAP_H - contentH * scale) / 2;

    const toMini = (wx: number, wy: number) => ({
      x: (wx - minX) * scale + offsetX,
      y: (wy - minY) * scale + offsetY,
    });

    // Resolve colours
    const colBlue = resolveCssVar('--ctp-blue') || '#89b4fa';
    const colGreen = resolveCssVar('--ctp-green') || '#a6e3a1';
    const colPeach = resolveCssVar('--ctp-peach') || '#fab387';
    const colSurface0 = resolveCssVar('--ctp-surface0') || '#313244';
    const colOverlay0 = resolveCssVar('--ctp-overlay0') || '#6c7086';
    const colAccent = resolveCssVar('--ctp-accent') || resolveCssVar('--ctp-blue') || '#89b4fa';

    // Draw edges as thin lines between node centres
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = colOverlay0;
    ctx.globalAlpha = 0.5;
    for (const edge of edges) {
      const fromNode = nodes.find((n) => n.id === edge.fromNode);
      const toNode = nodes.find((n) => n.id === edge.toNode);
      if (!fromNode || !toNode) continue;
      const from = toMini(
        fromNode.x + fromNode.width / 2,
        fromNode.y + fromNode.height / 2,
      );
      const to = toMini(
        toNode.x + toNode.width / 2,
        toNode.y + toNode.height / 2,
      );
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Draw nodes
    for (const node of nodes) {
      const p = toMini(node.x, node.y);
      const w = Math.max(2, node.width * scale);
      const h = Math.max(2, node.height * scale);

      if (node.type === 'group') {
        ctx.strokeStyle = colSurface0;
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x, p.y, w, h);
      } else {
        let fill = colBlue;
        if (node.type === 'file') fill = colGreen;
        if (node.type === 'link') fill = colPeach;

        ctx.fillStyle = fill;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(p.x, p.y, w, h);
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw viewport indicator
    const { x: vpX, y: vpY, zoom } = viewport;
    // The visible world rect: top-left is (-vpX, -vpY), size is (containerWidth/zoom, containerHeight/zoom)
    const vpWorldX = -vpX;
    const vpWorldY = -vpY;
    const vpWorldW = containerWidth / zoom;
    const vpWorldH = containerHeight / zoom;

    const vpMini = toMini(vpWorldX, vpWorldY);
    const vpMiniW = vpWorldW * scale;
    const vpMiniH = vpWorldH * scale;

    ctx.strokeStyle = colAccent;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(vpMini.x, vpMini.y, vpMiniW, vpMiniH);

    // Semi-transparent fill for viewport rect
    ctx.fillStyle = colAccent;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(vpMini.x, vpMini.y, vpMiniW, vpMiniH);
    ctx.globalAlpha = 1.0;
  }, [nodes, edges, viewport, containerWidth, containerHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: MINIMAP_W,
        height: MINIMAP_H,
        borderRadius: 6,
        border: '1px solid var(--ctp-surface1)',
        backgroundColor: 'color-mix(in srgb, var(--ctp-mantle) 80%, transparent)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        zIndex: 20,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}
