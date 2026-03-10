import { create } from 'zustand';
import type { CanvasNode, CanvasEdge, CanvasData, Viewport } from '../types/canvas';

type DragType = 'none' | 'pan' | 'move' | 'resize' | 'connect' | 'marquee';

interface DragState {
  type: DragType;
  startX: number;
  startY: number;
  nodeId?: string;
}

const MAX_UNDO = 50;

function genId(): string {
  return Math.random().toString(36).slice(2, 14);
}

interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  dragState: DragState;
  viewport: Viewport;
  editingNodeId: string | null;
  isDirty: boolean;
  filePath: string | null;
  undoStack: CanvasData[];
  redoStack: CanvasData[];
}

interface CanvasActions {
  loadCanvas: (filePath: string, data: CanvasData) => void;
  clearCanvas: () => void;
  addNode: (node: Omit<CanvasNode, 'id'> & { id?: string }) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  removeNodes: (ids: string[]) => void;
  addEdge: (edge: Omit<CanvasEdge, 'id'> & { id?: string }) => void;
  updateEdge: (id: string, updates: Partial<CanvasEdge>) => void;
  removeEdges: (ids: string[]) => void;
  selectNode: (id: string, additive?: boolean) => void;
  selectEdge: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setViewport: (partial: Partial<Viewport>) => void;
  zoomToFit: () => void;
  setDragState: (state: Partial<DragState> & { type: DragType }) => void;
  setEditingNode: (id: string | null) => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  toJSON: () => CanvasData;
  markClean: () => void;
}

const defaultDragState: DragState = { type: 'none', startX: 0, startY: 0 };
const defaultViewport: Viewport = { x: 0, y: 0, zoom: 1 };

export const useCanvasStore = create<CanvasState & CanvasActions>((set, get) => ({
  // State
  nodes: [],
  edges: [],
  selectedNodeIds: new Set(),
  selectedEdgeIds: new Set(),
  dragState: defaultDragState,
  viewport: defaultViewport,
  editingNodeId: null,
  isDirty: false,
  filePath: null,
  undoStack: [],
  redoStack: [],

  // Actions
  loadCanvas: (filePath, data) => {
    set({
      nodes: data.nodes,
      edges: data.edges,
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      dragState: defaultDragState,
      viewport: defaultViewport,
      editingNodeId: null,
      isDirty: false,
      filePath,
      undoStack: [],
      redoStack: [],
    });
  },

  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      dragState: defaultDragState,
      viewport: defaultViewport,
      editingNodeId: null,
      isDirty: false,
      filePath: null,
      undoStack: [],
      redoStack: [],
    });
  },

  addNode: (node) => {
    get().pushUndo();
    const id = node.id ?? genId();
    const newNode = { ...node, id } as CanvasNode;
    set((s) => ({ nodes: [...s.nodes, newNode], isDirty: true }));
  },

  updateNode: (id, updates) => {
    get().pushUndo();
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } as CanvasNode : n)),
      isDirty: true,
    }));
  },

  removeNodes: (ids) => {
    get().pushUndo();
    const idSet = new Set(ids);
    set((s) => ({
      nodes: s.nodes.filter((n) => !idSet.has(n.id)),
      edges: s.edges.filter((e) => !idSet.has(e.fromNode) && !idSet.has(e.toNode)),
      selectedNodeIds: new Set([...s.selectedNodeIds].filter((id) => !idSet.has(id))),
      isDirty: true,
    }));
  },

  addEdge: (edge) => {
    get().pushUndo();
    const id = edge.id ?? genId();
    const newEdge: CanvasEdge = { ...edge, id };
    set((s) => ({ edges: [...s.edges, newEdge], isDirty: true }));
  },

  updateEdge: (id, updates) => {
    get().pushUndo();
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      isDirty: true,
    }));
  },

  removeEdges: (ids) => {
    get().pushUndo();
    const idSet = new Set(ids);
    set((s) => ({
      edges: s.edges.filter((e) => !idSet.has(e.id)),
      selectedEdgeIds: new Set([...s.selectedEdgeIds].filter((id) => !idSet.has(id))),
      isDirty: true,
    }));
  },

  selectNode: (id, additive = false) => {
    set((s) => {
      if (additive) {
        const next = new Set(s.selectedNodeIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return { selectedNodeIds: next, selectedEdgeIds: new Set() };
      }
      return { selectedNodeIds: new Set([id]), selectedEdgeIds: new Set(), editingNodeId: null };
    });
  },

  selectEdge: (id) => {
    set({ selectedEdgeIds: new Set([id]), selectedNodeIds: new Set(), editingNodeId: null });
  },

  selectAll: () => {
    set((s) => ({
      selectedNodeIds: new Set(s.nodes.filter((n) => n.type !== 'group').map((n) => n.id)),
      selectedEdgeIds: new Set(),
    }));
  },

  clearSelection: () => {
    set({ selectedNodeIds: new Set(), selectedEdgeIds: new Set(), editingNodeId: null });
  },

  setViewport: (partial) => {
    set((s) => ({ viewport: { ...s.viewport, ...partial } }));
  },

  zoomToFit: () => {
    const { nodes } = get();
    if (nodes.length === 0) {
      set({ viewport: defaultViewport });
      return;
    }
    const PADDING = 60;
    const CANVAS_W = 800;
    const CANVAS_H = 600;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const zoom = Math.min(
      (CANVAS_W - PADDING * 2) / (contentW || 1),
      (CANVAS_H - PADDING * 2) / (contentH || 1),
      2,
    );
    const x = CANVAS_W / 2 - (minX + contentW / 2) * zoom;
    const y = CANVAS_H / 2 - (minY + contentH / 2) * zoom;
    set({ viewport: { x, y, zoom } });
  },

  setDragState: (state) => {
    set({ dragState: { startX: 0, startY: 0, ...state } });
  },

  setEditingNode: (id) => {
    set({ editingNodeId: id });
  },

  pushUndo: () => {
    const { nodes, edges, undoStack } = get();
    const snapshot: CanvasData = structuredClone({ nodes, edges });
    const next = [...undoStack, snapshot];
    if (next.length > MAX_UNDO) next.shift();
    set({ undoStack: next, redoStack: [] });
  },

  undo: () => {
    const { undoStack, nodes, edges, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const current: CanvasData = structuredClone({ nodes, edges });
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, current],
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      editingNodeId: null,
      isDirty: true,
    });
  },

  redo: () => {
    const { redoStack, nodes, edges, undoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const current: CanvasData = structuredClone({ nodes, edges });
    set({
      nodes: next.nodes,
      edges: next.edges,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, current],
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      editingNodeId: null,
      isDirty: true,
    });
  },

  toJSON: () => {
    const { nodes, edges } = get();
    return { nodes, edges };
  },

  markClean: () => {
    set({ isDirty: false });
  },
}));
