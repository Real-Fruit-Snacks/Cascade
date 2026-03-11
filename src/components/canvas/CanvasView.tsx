import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { useSettingsStore } from '../../stores/settings-store';
import { CanvasBackground } from './CanvasBackground';
import { CanvasCards } from './CanvasCards';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasInputModal } from './CanvasInputModal';
import { CanvasContextMenu } from './CanvasContextMenu';
import { CanvasSearch } from './CanvasSearch';
import { CanvasMinimap } from './CanvasMinimap';
import { useCanvasIO } from './useCanvasIO';
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts';
import { useCanvasDragSystem } from './useCanvasDragSystem';

interface CanvasViewProps {
  filePath: string;
  vaultPath: string;
}

export function CanvasView({ filePath, vaultPath }: CanvasViewProps) {
  const canvasShowMinimap = useSettingsStore((s) => s.canvasShowMinimap);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [inputModal, setInputModal] = useState<{ title: string; defaultValue?: string; onSubmit: (v: string) => void; onCancel: () => void } | null>(null);

  const requestInput = useCallback((title: string, defaultValue?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setInputModal({
        title,
        defaultValue,
        onSubmit: (v) => { setInputModal(null); resolve(v); },
        onCancel: () => { setInputModal(null); resolve(null); },
      });
    });
  }, []);

  // Load/save canvas data
  useCanvasIO(filePath, vaultPath);

  // Keyboard shortcuts and wheel zoom
  const { spaceDown } = useCanvasKeyboardShortcuts({ containerRef, setShowSearch });

  // All drag/mouse interaction
  const {
    connectDrag,
    marqueeDrag,
    contextMenu,
    setContextMenu,
    onCardMouseDown,
    onResizeMouseDown,
    onConnectMouseDown,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleDoubleClick,
    handleContextMenu,
    onCardContextMenu,
    handleDragOver,
    handleDrop,
    cursor,
  } = useCanvasDragSystem({ containerRef, spaceDown });

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
        useCanvasStore.getState().setContainerSize({ width, height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      data-canvas-container
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: 'var(--ctp-base)', cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {containerSize.width > 0 && (
        <CanvasBackground
          width={containerSize.width}
          height={containerSize.height}
          connectDrag={connectDrag}
          marqueeDrag={marqueeDrag}
        />
      )}
      <CanvasCards
        vaultPath={vaultPath}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        onCardMouseDown={onCardMouseDown}
        onResizeMouseDown={onResizeMouseDown}
        onConnectMouseDown={onConnectMouseDown}
        onCardContextMenu={onCardContextMenu}
      />
      <CanvasToolbar
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        requestInput={requestInput}
      />
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetNodeId={contextMenu.targetNodeId}
          targetEdgeId={contextMenu.targetEdgeId}
          worldX={contextMenu.worldX}
          worldY={contextMenu.worldY}
          vaultPath={vaultPath}
          onClose={() => setContextMenu(null)}
          requestInput={requestInput}
        />
      )}
      {showSearch && (
        <CanvasSearch onClose={() => setShowSearch(false)} />
      )}
      {inputModal && (
        <CanvasInputModal
          title={inputModal.title}
          defaultValue={inputModal.defaultValue}
          onSubmit={inputModal.onSubmit}
          onCancel={inputModal.onCancel}
        />
      )}
      {canvasShowMinimap && containerSize.width > 0 && (
        <CanvasMinimap
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      )}
    </div>
  );
}
