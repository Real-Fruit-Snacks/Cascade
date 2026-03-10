import { useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { CANVAS_COLORS, type LinkNode } from '../../../types/canvas';

interface LinkCardProps {
  node: LinkNode;
  selected: boolean;
  style: React.CSSProperties;
}

export function LinkCard({ node, selected, style }: LinkCardProps) {
  const selectNode = useCanvasStore((s) => s.selectNode);
  const colorVar = node.color ? CANVAS_COLORS[node.color] : undefined;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id, e.ctrlKey || e.metaKey);
  }, [node.id, selectNode]);

  let domain = '';
  try { domain = new URL(node.url).hostname; } catch { domain = node.url; }

  return (
    <div
      style={{
        ...style,
        backgroundColor: 'var(--ctp-surface0)',
        border: selected ? '2px solid var(--ctp-accent)' : '1px solid var(--ctp-surface1)',
        borderRadius: 8,
        borderLeft: colorVar ? `3px solid ${colorVar}` : undefined,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        cursor: 'default',
      }}
      onClick={handleClick}
      onDoubleClick={() => window.open(node.url, '_blank')}
    >
      <ExternalLink size={16} style={{ color: 'var(--ctp-accent)', flexShrink: 0 }} />
      <div className="overflow-hidden">
        <div className="text-sm truncate" style={{ color: 'var(--ctp-text)' }}>{domain}</div>
        <div className="text-xs truncate" style={{ color: 'var(--ctp-overlay0)' }}>{node.url}</div>
      </div>
    </div>
  );
}
