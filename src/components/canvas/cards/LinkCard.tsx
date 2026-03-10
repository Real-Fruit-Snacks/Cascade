import { useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useCanvasStore } from '../../../stores/canvas-store';
import { CANVAS_COLORS, type LinkNode } from '../../../types/canvas';
import type { ResizeCorner } from '../CanvasCards';
import { ResizeHandles } from './ResizeHandle';

interface LinkCardProps {
  node: LinkNode;
  selected: boolean;
  style: React.CSSProperties;
  onMouseDown?: (e: React.MouseEvent) => void;
  onResizeMouseDown?: (corner: ResizeCorner, e: React.MouseEvent) => void;
}

export function LinkCard({ node, selected, style, onMouseDown, onResizeMouseDown }: LinkCardProps) {
  const selectNode = useCanvasStore((s) => s.selectNode);
  const canvasTool = useCanvasStore((s) => s.canvasTool);
  const canvasLocked = useCanvasStore((s) => s.canvasLocked);
  const colorVar = node.color ? CANVAS_COLORS[node.color] : undefined;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canvasTool === 'hand') return;
    selectNode(node.id, e.ctrlKey || e.metaKey);
  }, [node.id, selectNode, canvasTool]);

  let domain = '';
  try { domain = new URL(node.url).hostname; } catch { domain = node.url; }

  const baseBorder = selected ? '2px solid var(--ctp-accent)' : '1px solid var(--ctp-surface1)';

  return (
    <div
      style={{
        ...style,
        backgroundColor: 'var(--ctp-surface0)',
        borderTop: baseBorder,
        borderRight: baseBorder,
        borderBottom: baseBorder,
        borderLeft: colorVar ? `3px solid ${colorVar}` : baseBorder,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        cursor: 'default',
      }}
      onClick={handleClick}
      onDoubleClick={() => { if (canvasTool !== 'hand' && !canvasLocked && !node.locked && /^https?:\/\//i.test(node.url)) openUrl(node.url).catch(() => window.open(node.url, '_blank', 'noopener')); }}
      onMouseDown={onMouseDown}
    >
      <ExternalLink size={16} style={{ color: 'var(--ctp-accent)', flexShrink: 0 }} />
      <div className="overflow-hidden">
        <div className="text-sm truncate" style={{ color: 'var(--ctp-text)' }}>{domain}</div>
        <div className="text-xs truncate" style={{ color: 'var(--ctp-overlay0)' }}>{node.url}</div>
      </div>
      {selected && onResizeMouseDown && (
        <ResizeHandles onResizeMouseDown={onResizeMouseDown} />
      )}
    </div>
  );
}
