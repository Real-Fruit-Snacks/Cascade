import { Type, FileText, Link, Square, ZoomOut, ZoomIn, Maximize2, Code, Lock, Pencil, Hand, MousePointer } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvas-store';
import { useSettingsStore } from '../../stores/settings-store';
import type { CanvasNode } from '../../types/canvas';

export interface CanvasToolbarProps {
  containerWidth: number;
  containerHeight: number;
  requestInput: (title: string, defaultValue?: string) => Promise<string | null>;
}

export function CanvasToolbar({ containerWidth, containerHeight, requestInput }: CanvasToolbarProps) {
  const addNode = useCanvasStore((s) => s.addNode);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const zoomToFit = useCanvasStore((s) => s.zoomToFit);
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const canvasLocked = useCanvasStore((s) => s.canvasLocked);
  const setCanvasLocked = useCanvasStore((s) => s.setCanvasLocked);
  const canvasTool = useCanvasStore((s) => s.canvasTool);
  const setCanvasTool = useCanvasStore((s) => s.setCanvasTool);
  const defaultW = useSettingsStore((s) => s.canvasDefaultCardWidth) || 260;
  const defaultH = useSettingsStore((s) => s.canvasDefaultCardHeight) || 140;

  const getCenter = (w: number, h: number) => {
    const cx = containerWidth / 2 / viewport.zoom - viewport.x;
    const cy = containerHeight / 2 / viewport.zoom - viewport.y;
    return { x: cx - w / 2, y: cy - h / 2 };
  };

  const addText = () => {
    const { x, y } = getCenter(defaultW, defaultH);
    addNode({ type: 'text', text: '', x, y, width: defaultW, height: defaultH } as Omit<CanvasNode, 'id'>);
  };

  const addFile = () => {
    const w = Math.max(defaultW, 300);
    const h = Math.max(defaultH, 200);
    const { x, y } = getCenter(w, h);
    addNode({ type: 'file', file: '', x, y, width: w, height: h } as Omit<CanvasNode, 'id'>);
  };

  const addLink = async () => {
    const url = await requestInput('Enter URL:');
    if (!url) return;
    const { x, y } = getCenter(defaultW, 100);
    addNode({ type: 'link', url, x, y, width: defaultW, height: 100 } as Omit<CanvasNode, 'id'>);
  };

  const addCode = () => {
    const { x, y } = getCenter(defaultW, defaultH);
    addNode({ type: 'text', text: '```\n\n```', x, y, width: defaultW, height: defaultH } as Omit<CanvasNode, 'id'>);
  };

  const addGroup = () => {
    const selectedNodes = nodes.filter((n) => selectedNodeIds.has(n.id));
    if (selectedNodes.length > 0) {
      const PAD = 40;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of selectedNodes) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + n.width > maxX) maxX = n.x + n.width;
        if (n.y + n.height > maxY) maxY = n.y + n.height;
      }
      addNode({
        type: 'group',
        label: 'Group',
        x: minX - PAD,
        y: minY - PAD,
        width: maxX - minX + PAD * 2,
        height: maxY - minY + PAD * 2,
      } as Omit<CanvasNode, 'id'>);
    } else {
      const { x, y } = getCenter(400, 300);
      addNode({ type: 'group', label: 'Group', x, y, width: 400, height: 300 } as Omit<CanvasNode, 'id'>);
    }
  };

  const zoomOut = () => {
    const newZoom = Math.max(0.25, viewport.zoom * 0.8);
    setViewport({ zoom: newZoom });
  };

  const zoomIn = () => {
    const newZoom = Math.min(4, viewport.zoom * 1.25);
    setViewport({ zoom: newZoom });
  };

  const resetZoom = () => {
    setViewport({ zoom: 1 });
  };

  const zoomPct = Math.round(viewport.zoom * 100);

  const btnClass =
    'flex items-center gap-1 px-2 py-1.5 rounded text-xs hover:bg-[var(--ctp-surface0)] transition-colors cursor-pointer select-none';

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 rounded-lg px-2 py-1"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--ctp-mantle) 90%, transparent)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        pointerEvents: 'auto',
        color: 'var(--ctp-text)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className={btnClass}
        onClick={() => setCanvasLocked(!canvasLocked)}
        title={canvasLocked ? 'Unlock canvas for editing' : 'Lock canvas (read-only)'}
      >
        {canvasLocked ? (
          <Lock size={14} style={{ color: 'var(--ctp-red)' }} />
        ) : (
          <Pencil size={14} style={{ color: 'var(--ctp-green)' }} />
        )}
      </button>

      <button
        className={btnClass}
        onClick={() => setCanvasTool(canvasTool === 'hand' ? 'select' : 'hand')}
        title={canvasTool === 'hand' ? 'Switch to select tool' : 'Switch to hand (pan) tool'}
      >
        {canvasTool === 'hand' ? (
          <Hand size={14} />
        ) : (
          <MousePointer size={14} />
        )}
      </button>

      <div
        className="w-px mx-1 self-stretch"
        style={{ backgroundColor: 'var(--ctp-surface1)' }}
      />

      <button className={btnClass} onClick={addText} title="Add text node" disabled={canvasLocked}>
        <Type size={14} style={{ opacity: canvasLocked ? 0.4 : 1 }} />
        <span style={{ opacity: canvasLocked ? 0.4 : 1 }}>Text</span>
      </button>
      <button className={btnClass} onClick={addFile} title="Add file node" disabled={canvasLocked}>
        <FileText size={14} style={{ opacity: canvasLocked ? 0.4 : 1 }} />
        <span style={{ opacity: canvasLocked ? 0.4 : 1 }}>Note</span>
      </button>
      <button className={btnClass} onClick={addLink} title="Add link node" disabled={canvasLocked}>
        <Link size={14} style={{ opacity: canvasLocked ? 0.4 : 1 }} />
        <span style={{ opacity: canvasLocked ? 0.4 : 1 }}>Link</span>
      </button>
      <button className={btnClass} onClick={addCode} title="Add code block" disabled={canvasLocked}>
        <Code size={14} style={{ opacity: canvasLocked ? 0.4 : 1 }} />
        <span style={{ opacity: canvasLocked ? 0.4 : 1 }}>Code</span>
      </button>
      <button className={btnClass} onClick={addGroup} title="Add group" disabled={canvasLocked}>
        <Square size={14} style={{ opacity: canvasLocked ? 0.4 : 1 }} />
        <span style={{ opacity: canvasLocked ? 0.4 : 1 }}>Group</span>
      </button>

      <div
        className="w-px mx-1 self-stretch"
        style={{ backgroundColor: 'var(--ctp-surface1)' }}
      />

      <button className={btnClass} onClick={zoomOut} title="Zoom out">
        <ZoomOut size={14} />
      </button>
      <button
        className={btnClass}
        onClick={resetZoom}
        title="Reset zoom to 100%"
        style={{ minWidth: '3rem', justifyContent: 'center' }}
      >
        {zoomPct}%
      </button>
      <button className={btnClass} onClick={zoomIn} title="Zoom in">
        <ZoomIn size={14} />
      </button>
      <button className={btnClass} onClick={zoomToFit} title="Zoom to fit">
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
