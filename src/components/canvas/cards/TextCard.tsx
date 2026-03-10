import { useCallback, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { CANVAS_COLORS, type TextNode } from '../../../types/canvas';
import type { ResizeCorner } from '../CanvasCards';
import { useMarkdown } from './useMarkdown';

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

  // Track textarea value in a ref so we can save even if blur doesn't fire
  // (e.g. when mousedown on canvas calls clearSelection before blur)
  const textRef = useRef(node.text);
  const wasEditingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      textRef.current = node.text;
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      // Editing just ended — save the latest text if it changed
      wasEditingRef.current = false;
      if (textRef.current !== node.text) {
        updateNode(node.id, { text: textRef.current });
      }
    }
  }, [isEditing, node.id, node.text, updateNode]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) {
      // Clicking inside the card while editing — refocus textarea
      textareaRef.current?.focus();
      return;
    }
    if (selected) {
      // Already selected — single click enters edit mode
      setEditingNode(node.id);
    } else {
      selectNode(node.id, e.ctrlKey || e.metaKey);
    }
  }, [node.id, selectNode, setEditingNode, selected, isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(node.id);
  }, [node.id, setEditingNode]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      // Prevent drag while editing; keep focus in textarea
      e.stopPropagation();
      return;
    }
    onMouseDown?.(e);
  }, [isEditing, onMouseDown]);

  const html = useMarkdown(node.text);
  const colorVar = node.color ? CANVAS_COLORS[node.color] : undefined;
  const baseBorder = selected ? '2px solid var(--ctp-accent)' : '1px solid var(--ctp-surface1)';

  return (
    <div
      ref={cardRef}
      style={{
        ...style,
        backgroundColor: 'var(--ctp-surface0)',
        borderTop: baseBorder,
        borderRight: baseBorder,
        borderBottom: baseBorder,
        borderLeft: colorVar ? `3px solid ${colorVar}` : baseBorder,
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'default',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          autoFocus
          defaultValue={node.text}
          className="w-full h-full p-3 text-sm resize-none outline-none"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--ctp-text)',
            fontFamily: 'var(--font-mono, monospace)',
          }}
          onChange={(e) => { textRef.current = e.target.value; }}
          onBlur={(e) => {
            // Only exit edit mode if focus moved outside the card
            const related = e.relatedTarget as HTMLElement | null;
            if (related && cardRef.current?.contains(related)) {
              // Clicked inside the card — refocus
              e.target.focus();
              return;
            }
            updateNode(node.id, { text: e.target.value });
            setEditingNode(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setEditingNode(null); }
          }}
        />
      ) : (
        <div className="p-3 text-sm overflow-y-auto h-full" style={{ color: 'var(--ctp-text)', wordBreak: 'break-word', boxSizing: 'border-box' }}>
          {node.text ? (
            <div className="canvas-markdown prose prose-sm" style={{ overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span style={{ color: 'var(--ctp-overlay0)', fontStyle: 'italic' }}>Empty card</span>
          )}
        </div>
      )}
      {node.locked && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        >
          <Lock size={12} style={{ color: 'var(--ctp-overlay0)' }} />
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
