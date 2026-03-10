import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, FileDown, Loader2 } from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { useEditorStore } from '../../../stores/editor-store';
import { CANVAS_COLORS, type FileNode } from '../../../types/canvas';
import { readFile, writeFile } from '../../../lib/tauri-commands';
import { useCanvasCodeMirror } from './use-canvas-codemirror';
import type { ResizeCorner } from '../CanvasCards';

interface FileCardProps {
  node: FileNode;
  selected: boolean;
  style: React.CSSProperties;
  vaultPath: string;
  onMouseDown?: (e: React.MouseEvent) => void;
  onResizeMouseDown?: (corner: ResizeCorner, e: React.MouseEvent) => void;
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);
const MARKDOWN_EXTS = new Set(['.md', '.markdown', '.mdx']);

export function FileCard({ node, selected, style, vaultPath, onMouseDown, onResizeMouseDown }: FileCardProps) {
  const selectNode = useCanvasStore((s) => s.selectNode);
  const editingNodeId = useCanvasStore((s) => s.editingNodeId);
  const setEditingNode = useCanvasStore((s) => s.setEditingNode);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ext = node.file.slice(node.file.lastIndexOf('.')).toLowerCase();
  const isImage = IMAGE_EXTS.has(ext);
  const isPdf = ext === '.pdf';
  const isMarkdown = MARKDOWN_EXTS.has(ext);
  const isEditing = editingNodeId === node.id;

  // -- Debounced auto-save refs --
  const pendingContentRef = useRef<string>(content);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    writeFile(vaultPath, node.file, pendingContentRef.current).catch(() => {
      // silent — file-watcher will reconcile
    });
  }, [vaultPath, node.file]);

  const handleContentChange = useCallback((newContent: string) => {
    pendingContentRef.current = newContent;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      writeFile(vaultPath, node.file, pendingContentRef.current).catch(() => {});
    }, 500);
  }, [vaultPath, node.file]);

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

  // -- Load file content --
  useEffect(() => {
    if (isImage || isPdf) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    readFile(vaultPath, node.file).then((c) => {
      if (!cancelled) {
        setContent(c);
        pendingContentRef.current = c;
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setError('File not found');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [node.file, vaultPath, isImage, isPdf]);

  // -- CM6 hook --
  const { editorRef } = useCanvasCodeMirror({
    content,
    editing: isEditing && isMarkdown,
    onContentChange: handleContentChange,
  });

  // -- Interaction handlers --
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return; // let CM6 handle clicks
    selectNode(node.id, e.ctrlKey || e.metaKey);
  }, [node.id, selectNode, isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMarkdown) {
      setEditingNode(node.id);
    } else {
      useEditorStore.getState().openFile(vaultPath, node.file, true);
    }
  }, [node.id, node.file, vaultPath, isMarkdown, setEditingNode]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    onMouseDown?.(e);
  }, [isEditing, onMouseDown]);

  const fileName = node.file.split('/').pop() || node.file;
  const colorVar = node.color ? CANVAS_COLORS[node.color] : undefined;
  const Icon = isImage ? ImageIcon : isPdf ? FileDown : FileText;
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
        flexDirection: 'column',
        cursor: 'default',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium shrink-0"
        style={{
          backgroundColor: 'var(--ctp-mantle)',
          borderBottom: '1px solid var(--ctp-surface1)',
          color: 'var(--ctp-subtext1)',
        }}
      >
        <Icon size={14} />
        <span className="truncate">{fileName}</span>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--ctp-overlay0)' }}>
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--ctp-red)', fontStyle: 'italic' }}>
            {error}
          </div>
        ) : isImage ? (
          <img
            src={`https://asset.localhost/${vaultPath.replace(/\\/g, '/')}/${node.file}`}
            alt={fileName}
            className="w-full h-full object-contain"
          />
        ) : isMarkdown ? (
          <div ref={editorRef} className="h-full" />
        ) : (
          <pre className="text-xs h-full whitespace-pre-wrap p-2 overflow-y-auto" style={{ color: 'var(--ctp-text)' }}>
            {content}
          </pre>
        )}
      </div>
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
