import { useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useCanvasStore } from '../../../stores/canvas-store';
import { CANVAS_COLORS, type LinkNode } from '../../../types/canvas';
import type { ResizeCorner } from '../CanvasCards';

interface LinkCardProps {
  node: LinkNode;
  selected: boolean;
  style: React.CSSProperties;
  onMouseDown?: (e: React.MouseEvent) => void;
  onResizeMouseDown?: (corner: ResizeCorner, e: React.MouseEvent) => void;
}

export function LinkCard({ node, selected, style, onMouseDown, onResizeMouseDown }: LinkCardProps) {
  const selectNode = useCanvasStore((s) => s.selectNode);
  const colorVar = node.color ? CANVAS_COLORS[node.color] : undefined;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id, e.ctrlKey || e.metaKey);
  }, [node.id, selectNode]);

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
      onDoubleClick={() => openUrl(node.url).catch(() => window.open(node.url, '_blank'))}
      onMouseDown={onMouseDown}
    >
      <ExternalLink size={16} style={{ color: 'var(--ctp-accent)', flexShrink: 0 }} />
      <div className="overflow-hidden">
        <div className="text-sm truncate" style={{ color: 'var(--ctp-text)' }}>{domain}</div>
        <div className="text-xs truncate" style={{ color: 'var(--ctp-overlay0)' }}>{node.url}</div>
      </div>
      {selected && onResizeMouseDown && (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 8,
              height: 8,
              backgroundColor: 'var(--ctp-accent)',
              borderRadius: 2,
              cursor: 'nwse-resize',
              zIndex: 10,
            }}
            onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown('br', e); }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              left: -4,
              width: 8,
              height: 8,
              backgroundColor: 'var(--ctp-accent)',
              borderRadius: 2,
              cursor: 'nesw-resize',
              zIndex: 10,
            }}
            onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown('bl', e); }}
          />
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 8,
              height: 8,
              backgroundColor: 'var(--ctp-accent)',
              borderRadius: 2,
              cursor: 'nesw-resize',
              zIndex: 10,
            }}
            onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown('tr', e); }}
          />
          <div
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
              width: 8,
              height: 8,
              backgroundColor: 'var(--ctp-accent)',
              borderRadius: 2,
              cursor: 'nwse-resize',
              zIndex: 10,
            }}
            onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown('tl', e); }}
          />
        </>
      )}
    </div>
  );
}
