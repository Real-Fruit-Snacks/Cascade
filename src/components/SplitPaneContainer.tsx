import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../stores/editor-store';
import { EditorPane } from './EditorPane';

const DIVIDER_SIZE = 4;
const MIN_PANE_PERCENT = 20;
const STORAGE_KEY = 'cascade-split-pane-ratio';

function loadSavedRatio(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const val = parseFloat(raw);
      if (val >= MIN_PANE_PERCENT && val <= 100 - MIN_PANE_PERCENT) return val;
    }
  } catch { /* ignore */ }
  return 50;
}

export function SplitPaneContainer() {
  const paneCount = useEditorStore((s) => s.panes.length);
  const splitDirection = useEditorStore((s) => s.splitDirection);

  const [ratio, setRatio] = useState(loadSavedRatio);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist ratio on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(ratio)); } catch { /* ignore */ }
  }, [ratio]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.userSelect = 'none';
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let newRatio: number;
      if (splitDirection === 'vertical') {
        newRatio = ((e.clientY - rect.top) / rect.height) * 100;
      } else {
        newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      }
      newRatio = Math.max(MIN_PANE_PERCENT, Math.min(100 - MIN_PANE_PERCENT, newRatio));
      setRatio(newRatio);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.userSelect = '';
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, splitDirection]);

  // Single pane mode — no split
  if (paneCount < 2) {
    return <EditorPane />;
  }

  const isVertical = splitDirection === 'vertical';

  return (
    <div
      ref={containerRef}
      className="flex flex-1 min-h-0 min-w-0 overflow-hidden"
      style={{ flexDirection: isVertical ? 'column' : 'row' }}
    >
      {/* Pane 0 */}
      <div
        style={{
          [isVertical ? 'height' : 'width']: `calc(${ratio}% - ${DIVIDER_SIZE / 2}px)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <EditorPane paneIndex={0} />
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={handleMouseDown}
        tabIndex={0}
        role="separator"
        aria-orientation={isVertical ? 'horizontal' : 'vertical'}
        aria-valuenow={Math.round(ratio)}
        aria-valuemin={MIN_PANE_PERCENT}
        aria-valuemax={100 - MIN_PANE_PERCENT}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 5 : 1;
          if (isVertical) {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setRatio((r) => Math.max(MIN_PANE_PERCENT, r - step));
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setRatio((r) => Math.min(100 - MIN_PANE_PERCENT, r + step));
            }
          } else {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setRatio((r) => Math.max(MIN_PANE_PERCENT, r - step));
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setRatio((r) => Math.min(100 - MIN_PANE_PERCENT, r + step));
            }
          }
        }}
        className={`split-divider ${isVertical ? 'split-divider--row' : 'split-divider--col'}${isDragging ? ' is-dragging' : ''}`}
      />

      {/* Pane 1 */}
      <div
        style={{
          [isVertical ? 'height' : 'width']: `calc(${100 - ratio}% - ${DIVIDER_SIZE / 2}px)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <EditorPane paneIndex={1} />
      </div>
    </div>
  );
}
