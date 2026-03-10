import { useCanvasStore } from '../../stores/canvas-store';
import { TextCard } from './cards/TextCard';
import { FileCard } from './cards/FileCard';
import { LinkCard } from './cards/LinkCard';

export type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

interface CanvasCardsProps {
  vaultPath: string;
  containerWidth: number;
  containerHeight: number;
  onCardMouseDown: (nodeId: string, e: React.MouseEvent) => void;
  onResizeMouseDown: (nodeId: string, corner: ResizeCorner, e: React.MouseEvent) => void;
}

export function CanvasCards({ vaultPath, containerWidth, containerHeight, onCardMouseDown, onResizeMouseDown }: CanvasCardsProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const viewport = useCanvasStore((s) => s.viewport);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);

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
        const style: React.CSSProperties = {
          position: 'absolute',
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          pointerEvents: 'auto',
        };

        const cardMouseDown = (e: React.MouseEvent) => onCardMouseDown(node.id, e);
        const resizeMouseDown = (corner: ResizeCorner, e: React.MouseEvent) => onResizeMouseDown(node.id, corner, e);

        switch (node.type) {
          case 'text':
            return (
              <TextCard
                key={node.id}
                node={node}
                selected={isSelected}
                style={style}
                onMouseDown={cardMouseDown}
                onResizeMouseDown={resizeMouseDown}
              />
            );
          case 'file':
            return (
              <FileCard
                key={node.id}
                node={node}
                selected={isSelected}
                style={style}
                vaultPath={vaultPath}
                onMouseDown={cardMouseDown}
                onResizeMouseDown={resizeMouseDown}
              />
            );
          case 'link':
            return (
              <LinkCard
                key={node.id}
                node={node}
                selected={isSelected}
                style={style}
                onMouseDown={cardMouseDown}
                onResizeMouseDown={resizeMouseDown}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
