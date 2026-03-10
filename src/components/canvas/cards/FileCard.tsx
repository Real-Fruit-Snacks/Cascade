import { useCallback, useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, FileDown, Loader2 } from 'lucide-react';
import { useCanvasStore } from '../../../stores/canvas-store';
import { useEditorStore } from '../../../stores/editor-store';
import { CANVAS_COLORS, type FileNode } from '../../../types/canvas';
import { readFile } from '../../../lib/tauri-commands';
import { useMarkdown } from './useMarkdown';
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
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ext = node.file.slice(node.file.lastIndexOf('.')).toLowerCase();
  const isImage = IMAGE_EXTS.has(ext);
  const isPdf = ext === '.pdf';
  const isMarkdown = MARKDOWN_EXTS.has(ext);

  useEffect(() => {
    if (isImage || isPdf) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    readFile(vaultPath, node.file).then((content) => {
      if (!cancelled) {
        setPreview(content);
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

  const markdownHtml = useMarkdown(isMarkdown ? preview : undefined);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id, e.ctrlKey || e.metaKey);
  }, [node.id, selectNode]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useEditorStore.getState().openFile(vaultPath, node.file, true);
  }, [node.file, vaultPath]);

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
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium"
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
      <div className="flex-1 overflow-y-auto p-2" style={{ minHeight: 0 }}>
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
          <div
            className="canvas-markdown prose prose-sm text-sm"
            style={{ color: 'var(--ctp-text)', wordBreak: 'break-word', overflow: 'hidden' }}
            dangerouslySetInnerHTML={{ __html: markdownHtml }}
          />
        ) : (
          <pre className="text-xs h-full whitespace-pre-wrap" style={{ color: 'var(--ctp-text)' }}>
            {preview}
          </pre>
        )}
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
