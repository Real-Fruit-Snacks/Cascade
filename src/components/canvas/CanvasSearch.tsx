import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvas-store';
import type { CanvasNode } from '../../types/canvas';

interface CanvasSearchProps {
  onClose: () => void;
}

/** Extract searchable text from a canvas node */
function getNodeText(node: CanvasNode): string {
  switch (node.type) {
    case 'text':
      return node.text;
    case 'file':
      return node.file;
    case 'link':
      return node.url;
    case 'group':
      return node.label ?? '';
  }
}

export function CanvasSearch({ onClose }: CanvasSearchProps) {
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute matches from current nodes
  const nodes = useCanvasStore((s) => s.nodes);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const selectNode = useCanvasStore((s) => s.selectNode);

  const matches = useMemo<CanvasNode[]>(
    () =>
      query.length > 0
        ? nodes.filter((n) => getNodeText(n).toLowerCase().includes(query.toLowerCase()))
        : [],
    [query, nodes],
  );

  const navigateTo = useCallback(
    (index: number) => {
      if (matches.length === 0) return;
      const wrapped = ((index % matches.length) + matches.length) % matches.length;
      setMatchIndex(wrapped);
      const node = matches[wrapped];
      if (!node) return;

      // Select the node
      selectNode(node.id, false);

      // Pan viewport to center on the node.
      // We read the container size from the DOM since the store doesn't track it.
      const container = document.querySelector<HTMLElement>('[data-canvas-container]');
      const cw = container?.clientWidth ?? 800;
      const ch = container?.clientHeight ?? 600;
      const zoom = useCanvasStore.getState().viewport.zoom;
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      setViewport({
        x: cw / 2 / zoom - cx,
        y: ch / 2 / zoom - cy,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches, selectNode, setViewport],
  );

  // Reset match index when query changes
  useEffect(() => {
    setMatchIndex(0);
    if (matches.length > 0) {
      navigateTo(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      navigateTo(matchIndex + 1);
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && e.shiftKey) {
      navigateTo(matchIndex - 1);
      e.preventDefault();
      return;
    }
  };

  return (
    <div
      className="absolute top-3 right-3 z-50 flex items-center gap-1 rounded-lg px-2 py-1"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--ctp-mantle) 95%, transparent)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        color: 'var(--ctp-text)',
        pointerEvents: 'auto',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Search size={14} style={{ color: 'var(--ctp-subtext0)', flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search cards..."
        className="bg-transparent border-none outline-none text-xs px-1 py-1"
        style={{
          color: 'var(--ctp-text)',
          width: '160px',
          caretColor: 'var(--ctp-accent)',
        }}
      />
      {query.length > 0 && (
        <span
          className="text-xs whitespace-nowrap"
          style={{ color: 'var(--ctp-subtext0)' }}
        >
          {matches.length > 0 ? `${matchIndex + 1} of ${matches.length}` : 'No results'}
        </span>
      )}
      <button
        className="p-0.5 rounded hover:bg-[var(--ctp-surface0)] transition-colors cursor-pointer"
        onClick={() => navigateTo(matchIndex - 1)}
        title="Previous match (Shift+Enter)"
        disabled={matches.length === 0}
      >
        <ChevronUp size={14} />
      </button>
      <button
        className="p-0.5 rounded hover:bg-[var(--ctp-surface0)] transition-colors cursor-pointer"
        onClick={() => navigateTo(matchIndex + 1)}
        title="Next match (Enter)"
        disabled={matches.length === 0}
      >
        <ChevronDown size={14} />
      </button>
      <button
        className="p-0.5 rounded hover:bg-[var(--ctp-surface0)] transition-colors cursor-pointer"
        onClick={onClose}
        title="Close (Escape)"
      >
        <X size={14} />
      </button>
    </div>
  );
}
