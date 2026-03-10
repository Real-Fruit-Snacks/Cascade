import { useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { TextCard } from './cards/TextCard';
import { FileCard } from './cards/FileCard';
import { LinkCard } from './cards/LinkCard';
import type { EdgeSide } from '../../types/canvas';

export type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

interface CanvasCardsProps {
  vaultPath: string;
  containerWidth: number;
  containerHeight: number;
  onCardMouseDown: (nodeId: string, e: React.MouseEvent) => void;
  onResizeMouseDown: (nodeId: string, corner: ResizeCorner, e: React.MouseEvent) => void;
  onConnectMouseDown: (nodeId: string, side: EdgeSide, e: React.MouseEvent) => void;
}

const HANDLE_SIDES: EdgeSide[] = ['top', 'right', 'bottom', 'left'];

// Position a connection handle dot relative to the card (in world-space percentages / px)
function handleStyle(side: EdgeSide): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: 'var(--ctp-blue)',
    border: '2px solid var(--ctp-base)',
    cursor: 'crosshair',
    zIndex: 20,
    transform: 'translate(-50%, -50%)',
  };
  switch (side) {
    case 'top':    return { ...base, top: 0, left: '50%' };
    case 'bottom': return { ...base, top: '100%', left: '50%' };
    case 'left':   return { ...base, top: '50%', left: 0 };
    case 'right':  return { ...base, top: '50%', left: '100%' };
  }
}

export function CanvasCards({
  vaultPath,
  containerWidth,
  containerHeight,
  onCardMouseDown,
  onResizeMouseDown,
  onConnectMouseDown,
}: CanvasCardsProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const viewport = useCanvasStore((s) => s.viewport);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Viewport culling — only render nodes visible in viewport + margin
  const margin = 200;
  const visibleNodes = nodes.filter((node) => {
    if (node.type === 'group') return false; // Groups rendered on canvas layer
    const screenX = (node.x + viewport.x) * viewport.zoom;
    const screenY = (node.y + viewport.y) * viewport.zoom;
    const screenW = node.width * viewport.zoom;
    const screenH = node.height * viewport.zoom;
    return (
      screenX + screenW > -margin &&
      screenX < containerWidth + margin &&
      screenY + screenH > -margin &&
      screenY < containerHeight + margin
    );
  });

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        transformOrigin: '0 0',
        transform: `scale(${viewport.zoom}) translate(${viewport.x}px, ${viewport.y}px)`,
      }}
    >
      {visibleNodes.map((node) => {
        const isSelected = selectedNodeIds.has(node.id);
        const isHovered = hoveredNodeId === node.id;
        const style: React.CSSProperties = {
          position: 'absolute',
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          pointerEvents: 'auto',
        };

        const cardMouseDown = (e: React.MouseEvent) => onCardMouseDown(node.id, e);
        const resizeMouseDown = (corner: ResizeCorner, e: React.MouseEvent) =>
          onResizeMouseDown(node.id, corner, e);

        // Connection handle dots — shown when card is hovered or selected
        const handles = (isHovered || isSelected) && (
          <>
            {HANDLE_SIDES.map((side) => (
              <div
                key={side}
                style={handleStyle(side)}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onConnectMouseDown(node.id, side, e);
                }}
              />
            ))}
          </>
        );

        const wrapperProps = {
          style,
          onMouseEnter: () => setHoveredNodeId(node.id),
          onMouseLeave: () => setHoveredNodeId((prev) => (prev === node.id ? null : prev)),
        };

        switch (node.type) {
          case 'text':
            return (
              <div key={node.id} {...wrapperProps}>
                <TextCard
                  node={node}
                  selected={isSelected}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  onMouseDown={cardMouseDown}
                  onResizeMouseDown={resizeMouseDown}
                />
                {handles}
              </div>
            );
          case 'file':
            return (
              <div key={node.id} {...wrapperProps}>
                <FileCard
                  node={node}
                  selected={isSelected}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  vaultPath={vaultPath}
                  onMouseDown={cardMouseDown}
                  onResizeMouseDown={resizeMouseDown}
                />
                {handles}
              </div>
            );
          case 'link':
            return (
              <div key={node.id} {...wrapperProps}>
                <LinkCard
                  node={node}
                  selected={isSelected}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  onMouseDown={cardMouseDown}
                  onResizeMouseDown={resizeMouseDown}
                />
                {handles}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
