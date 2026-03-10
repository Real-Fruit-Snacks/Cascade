import { useCallback, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { CANVAS_COLORS, type TextNode } from '../../../types/canvas';
import { useCanvasCodeMirror } from './use-canvas-codemirror';
import { fitNodeToContent } from '../canvas-fit-to-content';
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

  // -- Debounced save to canvas store --
  const pendingContentRef = useRef<string>(node.text);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    updateNode(node.id, { text: pendingContentRef.current });
  }, [node.id, updateNode]);

  const handleContentChange = useCallback((newContent: string) => {
    pendingContentRef.current = newContent;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      updateNode(node.id, { text: pendingContentRef.current });
    }, 500);
  }, [node.id, updateNode]);

  // Flush save when editing ends
  const wasEditingRef = useRef(false);
  useEffect(() => {
    if (isEditing) {
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false;
      flushSave();
    }
  }, [isEditing, flushSave]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  // -- CM6 hook --
  const { editorRef } = useCanvasCodeMirror({
    content: node.text,
    editing: isEditing,
    onContentChange: handleContentChange,
    onEscape: () => setEditingNode(null),
  });

  // Double-click bottom edge to auto-fit card height to content
  const handleAutoFitHeight = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fitNodeToContent(node.id, 60);
  }, [node.id]);

  // -- Interaction handlers --
  const canvasLocked = useCanvasStore((s) => s.canvasLocked);
  const canvasTool = useCanvasStore((s) => s.canvasTool);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canvasTool === 'hand') return;
    if (isEditing) return; // let CM6 handle clicks
    if (!canvasLocked && !node.locked && selected) {
      setEditingNode(node.id);
    } else {
      selectNode(node.id, e.ctrlKey || e.metaKey);
    }
  }, [node.id, node.locked, selectNode, setEditingNode, selected, isEditing, canvasLocked, canvasTool]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canvasTool === 'hand') return;
    if (canvasLocked || node.locked) return;
    setEditingNode(node.id);
  }, [node.id, node.locked, setEditingNode, canvasLocked, canvasTool]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    onMouseDown?.(e);
  }, [isEditing, onMouseDown]);

  const colorVar = node.color ? CANVAS_COLORS[node.color] : undefined;
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
        cursor: 'default',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
    >
      <div ref={editorRef} className="canvas-card-editor h-full" />
      {(canvasTool === 'hand' || ((canvasLocked || node.locked) && !isEditing)) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      )}
      {/* Auto-fit height zone — double-click bottom edge */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 8,
          right: 8,
          height: 6,
          cursor: 'row-resize',
          zIndex: 5,
        }}
        onDoubleClick={handleAutoFitHeight}
      />
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
