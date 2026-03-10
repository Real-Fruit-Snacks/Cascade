import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { readFile, writeFile } from '../../lib/tauri-commands';
import type { CanvasData } from '../../types/canvas';

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

  const [_containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: 'var(--ctp-base)' }}
    >
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
