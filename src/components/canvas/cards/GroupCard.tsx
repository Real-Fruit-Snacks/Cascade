import { useCallback } from 'react';
import { useCanvasStore } from '../../../stores/canvas-store';
import type { GroupNode } from '../../../types/canvas';
import type { ResizeCorner } from '../CanvasCards';

interface GroupCardProps {
  node: GroupNode;
  selected: boolean;
  style: React.CSSProperties;
  onMouseDown?: (e: React.MouseEvent) => void;
  onResizeMouseDown?: (corner: ResizeCorner, e: React.MouseEvent) => void;
}

export function GroupCard({ node, selected, style, onMouseDown, onResizeMouseDown }: GroupCardProps) {
  const selectNode = useCanvasStore((s) => s.selectNode);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id, e.ctrlKey || e.metaKey);
  }, [node.id, selectNode]);

  return (
    <div
      style={{
        ...style,
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'default',
      }}
      onClick={handleClick}
      onMouseDown={onMouseDown}
    >
      {/* Label rendered by CanvasBackground canvas layer; DOM label hidden to avoid duplication */}
      {selected && onResizeMouseDown && (
        <>
          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
            <div
              key={corner}
              onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(corner, e); }}
              style={{
                position: 'absolute',
                width: 8,
                height: 8,
                backgroundColor: 'var(--ctp-accent)',
                borderRadius: 2,
                zIndex: 10,
                ...(corner.includes('t') ? { top: -4 } : { bottom: -4 }),
                ...(corner.includes('l') ? { left: -4 } : { right: -4 }),
                cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
