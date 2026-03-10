import { useCallback } from 'react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { CANVAS_COLORS, type TextNode } from '../../../types/canvas';

interface TextCardProps {
  node: TextNode;
  selected: boolean;
  style: React.CSSProperties;
}

export function TextCard({ node, selected, style }: TextCardProps) {
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
    </div>
  );
}
