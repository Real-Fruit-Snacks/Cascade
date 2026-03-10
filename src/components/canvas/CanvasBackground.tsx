import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';

interface CanvasBackgroundProps {
  width: number;
  height: number;
}

export function CanvasBackground({ width, height }: CanvasBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewport = useCanvasStore((s) => s.viewport);

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
    const gridSize = 20 * zoom;

    if (gridSize < 5) return;

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
  }, [width, height, viewport]);

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
