import { useCallback } from 'react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { CANVAS_COLORS, type TextNode } from '../../../types/canvas';
import type { ResizeCorner } from '../CanvasCards';

interface TextCardProps {
  node: TextNode;
  selected: boolean;
  style: React.CSSProperties;
  onMouseDown?: (e: React.MouseEvent) => void;
  onResizeMouseDown?: (corner: ResizeCorner, e: React.MouseEvent) => void;
}

export function TextCard({ node, selected, style, onMouseDown, onResizeMouseDown }: TextCardProps) {
  const selectNode = useCanvasStore((s) => s.selectNode);
  const setEditingNode = useCanvasStore((s) => s.setEditingNode);
  const editingNodeId = useCanvasStore((s) => s.editingNodeId);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const isEditing = editingNodeId === node.id;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id, e.ctrlKey || e.metaKey);
  }, [node.id, selectNode]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(node.id);
  }, [node.id, setEditingNode]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    onMouseDown?.(e);
  }, [isEditing, onMouseDown]);

  const colorVar = node.color ? CANVAS_COLORS[node.color] : undefined;

  return (
    <div
      style={{
        ...style,
        backgroundColor: 'var(--ctp-surface0)',
        border: selected ? '2px solid var(--ctp-accent)' : '1px solid var(--ctp-surface1)',
        borderRadius: 8,
        borderLeft: colorVar ? `3px solid ${colorVar}` : undefined,
        overflow: 'hidden',
        cursor: 'default',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
    >
      {isEditing ? (
        <textarea
          autoFocus
          defaultValue={node.text}
          className="w-full h-full p-3 text-sm resize-none outline-none"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--ctp-text)',
            fontFamily: 'var(--font-mono, monospace)',
          }}
          onBlur={(e) => {
            updateNode(node.id, { text: e.target.value });
            setEditingNode(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setEditingNode(null); }
          }}
        />
      ) : (
        <div className="p-3 text-sm overflow-y-auto h-full" style={{ color: 'var(--ctp-text)' }}>
          {node.text || <span style={{ color: 'var(--ctp-overlay0)', fontStyle: 'italic' }}>Empty card</span>}
        </div>
      )}
      {selected && !isEditing && onResizeMouseDown && (
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
