import { useEffect } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { useSettingsStore } from '../../stores/settings-store';
import { readFile, writeFile } from '../../lib/tauri-commands';
import type { CanvasData } from '../../types/canvas';
import { gridLayout, treeLayout, forceLayout } from './CanvasAutoLayout';
import { createLogger } from '../../lib/logger';

const log = createLogger('CanvasIO');

export function useCanvasIO(filePath: string, vaultPath: string) {
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const isDirty = useCanvasStore((s) => s.isDirty);
  const markClean = useCanvasStore((s) => s.markClean);
  const toJSON = useCanvasStore((s) => s.toJSON);

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
        log.error('save failed:', err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isDirty, filePath, vaultPath, toJSON, markClean]);
}
