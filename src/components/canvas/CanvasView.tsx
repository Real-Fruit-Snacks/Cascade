import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { readFile, writeFile } from '../../lib/tauri-commands';
import type { CanvasData } from '../../types/canvas';
import { CanvasBackground } from './CanvasBackground';

interface CanvasViewProps {
  filePath: string;
  vaultPath: string;
}

export function CanvasView({ filePath, vaultPath }: CanvasViewProps) {
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const isDirty = useCanvasStore((s) => s.isDirty);
  const markClean = useCanvasStore((s) => s.markClean);
  const toJSON = useCanvasStore((s) => s.toJSON);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const clearSelection = useCanvasStore((s) => s.clearSelection);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan state
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panViewportStart = useRef({ x: 0, y: 0 });
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const isMiddle = e.button === 1;
    const isLeftWithSpace = e.button === 0 && spaceDown.current;

    if (isMiddle || isLeftWithSpace) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panViewportStart.current = { x: viewport.x, y: viewport.y };
      e.preventDefault();
      return;
    }

    // Click on empty canvas (the container itself) clears selection
    if (e.button === 0 && e.target === e.currentTarget) {
      clearSelection();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning.current) return;
    const dx = (e.clientX - panStart.current.x) / viewport.zoom;
    const dy = (e.clientY - panStart.current.y) / viewport.zoom;
    setViewport({
      x: panViewportStart.current.x + dx,
      y: panViewportStart.current.y + dy,
    });
  };

  const stopPan = () => {
    isPanning.current = false;
  };

  const cursor = isPanning.current || spaceDown.current ? 'grab' : undefined;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: 'var(--ctp-base)', cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
      {containerSize.width > 0 && (
        <CanvasBackground width={containerSize.width} height={containerSize.height} />
      )}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ color: 'var(--ctp-overlay0)', pointerEvents: 'none' }}
      >
        <span className="text-sm select-none">
          Canvas: {nodes.length} nodes, {edges.length} edges
        </span>
      </div>
    </div>
  );
}
