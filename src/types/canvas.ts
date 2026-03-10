export type NodeType = 'text' | 'file' | 'link' | 'group';
export type EdgeSide = 'top' | 'right' | 'bottom' | 'left';
export type CanvasColor = '0' | '1' | '2' | '3' | '4' | '5' | '6';

export interface CanvasNodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
  locked?: boolean;
}

export interface TextNode extends CanvasNodeBase {
  type: 'text';
  text: string;
}

export interface FileNode extends CanvasNodeBase {
  type: 'file';
  file: string;
  subpath?: string;
}

export interface LinkNode extends CanvasNodeBase {
  type: 'link';
  url: string;
}

export interface GroupNode extends CanvasNodeBase {
  type: 'group';
  label?: string;
}

export type CanvasNode = TextNode | FileNode | LinkNode | GroupNode;

export type ArrowEnd = 'none' | 'arrow';
export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide: EdgeSide;
  toNode: string;
  toSide: EdgeSide;
  color?: CanvasColor;
  label?: string;
  fromEnd?: ArrowEnd;
  toEnd?: ArrowEnd;
  lineStyle?: LineStyle;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Map Obsidian color codes to Catppuccin CSS variable names */
export const CANVAS_COLORS: Record<CanvasColor, string> = {
  '0': 'var(--ctp-text)',
  '1': 'var(--ctp-red)',
  '2': 'var(--ctp-peach)',
  '3': 'var(--ctp-yellow)',
  '4': 'var(--ctp-green)',
  '5': 'var(--ctp-teal)',
  '6': 'var(--ctp-mauve)',
};
