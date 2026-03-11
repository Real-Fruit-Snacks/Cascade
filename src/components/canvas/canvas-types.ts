import type { ResizeCorner } from './CanvasCards';
import type { CanvasNode, CanvasEdge, EdgeSide } from '../../types/canvas';

export type { CanvasNode, CanvasEdge, EdgeSide };

export type DragMode = 'none' | 'pan' | 'move' | 'resize' | 'connect' | 'marquee';

export interface MoveDragRef {
  mode: 'move';
  startX: number;
  startY: number;
  origPositions: Map<string, { x: number; y: number }>;
  undoPushed: boolean;
}

export interface ResizeDragRef {
  mode: 'resize';
  nodeId: string;
  corner: ResizeCorner;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

export interface PanDragRef {
  mode: 'pan';
  startX: number;
  startY: number;
  vpX: number;
  vpY: number;
}

export interface ConnectDragRef {
  mode: 'connect';
  fromNodeId: string;
  fromSide: EdgeSide;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface NoDragRef {
  mode: 'none';
}

export interface MarqueeDragRef {
  mode: 'marquee';
  startWX: number;
  startWY: number;
  currentWX: number;
  currentWY: number;
  additive: boolean;
}

export type DragRef = NoDragRef | PanDragRef | MoveDragRef | ResizeDragRef | ConnectDragRef | MarqueeDragRef;

export const MIN_CARD_W = 100;
export const MIN_CARD_H = 60;
export const EDGE_HIT_RADIUS = 8;
export const BEZIER_SAMPLE_COUNT = 30;
export const CTRL_OFFSET = 80;
export const DEFAULT_GRID_SIZE = 20;

export interface ClipboardData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface ContextMenuState {
  x: number;
  y: number;
  targetNodeId?: string;
  targetEdgeId?: string;
  worldX: number;
  worldY: number;
}
