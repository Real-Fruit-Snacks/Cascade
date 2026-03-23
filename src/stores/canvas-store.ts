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
  return crypto.randomUUID();
}

interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  dragState: DragState;
  viewport: Viewport;
  editingNodeId: string | null;
  canvasLocked: boolean;
  canvasTool: 'select' | 'hand';
  isDirty: boolean;
  filePath: string | null;
  undoStack: CanvasData[];
  redoStack: CanvasData[];
  containerSize: { width: number; height: number };
}

interface CanvasActions {
  loadCanvas: (filePath: string, data: CanvasData) => void;
  clearCanvas: () => void;
  setContainerSize: (size: { width: number; height: number }) => void;
  addNode: (node: Omit<CanvasNode, 'id'> & { id?: string }, skipUndo?: boolean) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>, skipUndo?: boolean) => void;
  removeNodes: (ids: string[]) => void;
  addEdge: (edge: Omit<CanvasEdge, 'id'> & { id?: string }) => void;
  updateEdge: (id: string, updates: Partial<CanvasEdge>) => void;
  removeEdges: (ids: string[]) => void;
  selectNode: (id: string, additive?: boolean) => void;
  selectNodes: (ids: string[], additive?: boolean) => void;
  selectEdge: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setViewport: (partial: Partial<Viewport>) => void;
  zoomToFit: () => void;
  setDragState: (state: Partial<DragState> & { type: DragType }) => void;
  setEditingNode: (id: string | null) => void;
  setCanvasLocked: (locked: boolean) => void;
  setCanvasTool: (tool: 'select' | 'hand') => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  alignNodes: (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distributeNodes: (axis: 'horizontal' | 'vertical') => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  toggleLock: (ids: string[]) => void;
  applyLayout: (layoutFn: (nodes: CanvasNode[], edges: CanvasEdge[]) => CanvasNode[] | Promise<CanvasNode[]>) => void;
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
  canvasLocked: true,
  canvasTool: 'hand',
  isDirty: false,
  filePath: null,
  undoStack: [],
  redoStack: [],
  containerSize: { width: 800, height: 600 },

  // Actions
  setContainerSize: (size) => {
    set({ containerSize: size });
  },

  loadCanvas: (filePath, data) => {
    set({
      nodes: data.nodes,
      edges: data.edges,
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      dragState: defaultDragState,
      viewport: defaultViewport,
      editingNodeId: null,
      canvasLocked: true,
      canvasTool: 'hand',
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
      canvasLocked: true,
      canvasTool: 'hand',
      isDirty: false,
      filePath: null,
      undoStack: [],
      redoStack: [],
    });
  },

  addNode: (node, skipUndo = false) => {
    if (!skipUndo) get().pushUndo();
    const id = node.id ?? genId();
    const newNode = { ...node, id } as CanvasNode;
    set((s) => ({ nodes: [...s.nodes, newNode], isDirty: true }));
  },

  updateNode: (id, updates, skipUndo = false) => {
    if (!skipUndo) get().pushUndo();
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } as CanvasNode : n)),
      isDirty: true,
    }));
  },

  removeNodes: (ids) => {
    // Filter out locked nodes
    const unlocked = ids.filter((id) => {
      const node = get().nodes.find((n) => n.id === id);
      return node && !node.locked;
    });
    if (unlocked.length === 0) return;
    get().pushUndo();
    const idSet = new Set(unlocked);
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

  selectNodes: (ids, additive = false) => {
    set((s) => {
      const next = additive ? new Set(s.selectedNodeIds) : new Set<string>();
      for (const id of ids) next.add(id);
      return { selectedNodeIds: next, selectedEdgeIds: new Set(), editingNodeId: null };
    });
  },

  selectEdge: (id) => {
    set({ selectedEdgeIds: new Set([id]), selectedNodeIds: new Set(), editingNodeId: null });
  },

  // Groups are containers, not selectable content — exclude them from select-all
  // to match Obsidian Canvas behavior where Ctrl+A selects cards but not group frames.
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
    const { nodes, containerSize } = get();
    if (nodes.length === 0) {
      set({ viewport: defaultViewport });
      return;
    }
    const PADDING = 60;
    const CANVAS_W = containerSize.width;
    const CANVAS_H = containerSize.height;

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

  setCanvasLocked: (locked) => {
    set({ canvasLocked: locked, editingNodeId: null });
  },

  setCanvasTool: (tool) => {
    set({ canvasTool: tool });
  },

  pushUndo: () => {
    const { nodes, edges, undoStack } = get();
    const snapshot: CanvasData = { nodes: [...nodes], edges: [...edges] };
    const next = [...undoStack, snapshot];
    if (next.length > MAX_UNDO) next.shift();
    set({ undoStack: next, redoStack: [] });
  },

  undo: () => {
    const { undoStack, nodes, edges, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const current: CanvasData = { nodes: [...nodes], edges: [...edges] };
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
    const current: CanvasData = { nodes: [...nodes], edges: [...edges] };
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
    return { nodes: [...nodes], edges: [...edges] };
  },

  markClean: () => {
    set({ isDirty: false });
  },

  alignNodes: (direction) => {
    const { nodes, selectedNodeIds } = get();
    const selected = nodes.filter((n) => selectedNodeIds.has(n.id));
    if (selected.length < 2) return;

    get().pushUndo();

    const updates: Map<string, Partial<CanvasNode>> = new Map();

    if (direction === 'left') {
      const minX = Math.min(...selected.map((n) => n.x));
      for (const n of selected) updates.set(n.id, { x: minX });
    } else if (direction === 'center') {
      const minX = Math.min(...selected.map((n) => n.x));
      const maxRight = Math.max(...selected.map((n) => n.x + n.width));
      const centerX = (minX + maxRight) / 2;
      for (const n of selected) updates.set(n.id, { x: centerX - n.width / 2 });
    } else if (direction === 'right') {
      const maxRight = Math.max(...selected.map((n) => n.x + n.width));
      for (const n of selected) updates.set(n.id, { x: maxRight - n.width });
    } else if (direction === 'top') {
      const minY = Math.min(...selected.map((n) => n.y));
      for (const n of selected) updates.set(n.id, { y: minY });
    } else if (direction === 'middle') {
      const minY = Math.min(...selected.map((n) => n.y));
      const maxBottom = Math.max(...selected.map((n) => n.y + n.height));
      const centerY = (minY + maxBottom) / 2;
      for (const n of selected) updates.set(n.id, { y: centerY - n.height / 2 });
    } else if (direction === 'bottom') {
      const maxBottom = Math.max(...selected.map((n) => n.y + n.height));
      for (const n of selected) updates.set(n.id, { y: maxBottom - n.height });
    }

    set((s) => ({
      nodes: s.nodes.map((n) => {
        const u = updates.get(n.id);
        return u ? { ...n, ...u } as CanvasNode : n;
      }),
      isDirty: true,
    }));
  },

  distributeNodes: (axis) => {
    const { nodes, selectedNodeIds } = get();
    const selected = nodes.filter((n) => selectedNodeIds.has(n.id));
    if (selected.length < 3) return;

    get().pushUndo();

    const updates: Map<string, Partial<CanvasNode>> = new Map();

    if (axis === 'horizontal') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalWidth = sorted.reduce((sum, n) => sum + n.width, 0);
      const totalSpace = (last.x + last.width) - first.x - totalWidth;
      const gap = totalSpace / (sorted.length - 1);
      let currentX = first.x + first.width + gap;
      for (let i = 1; i < sorted.length - 1; i++) {
        updates.set(sorted[i].id, { x: currentX });
        currentX += sorted[i].width + gap;
      }
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalHeight = sorted.reduce((sum, n) => sum + n.height, 0);
      const totalSpace = (last.y + last.height) - first.y - totalHeight;
      const gap = totalSpace / (sorted.length - 1);
      let currentY = first.y + first.height + gap;
      for (let i = 1; i < sorted.length - 1; i++) {
        updates.set(sorted[i].id, { y: currentY });
        currentY += sorted[i].height + gap;
      }
    }

    set((s) => ({
      nodes: s.nodes.map((n) => {
        const u = updates.get(n.id);
        return u ? { ...n, ...u } as CanvasNode : n;
      }),
      isDirty: true,
    }));
  },

  bringToFront: (id) => {
    get().pushUndo();
    set((s) => {
      const idx = s.nodes.findIndex((n) => n.id === id);
      if (idx === -1 || idx === s.nodes.length - 1) return {};
      const next = [...s.nodes];
      const [node] = next.splice(idx, 1);
      next.push(node);
      return { nodes: next, isDirty: true };
    });
  },

  sendToBack: (id) => {
    get().pushUndo();
    set((s) => {
      const idx = s.nodes.findIndex((n) => n.id === id);
      if (idx === -1) return {};
      const next = [...s.nodes];
      const [node] = next.splice(idx, 1);
      // Insert after the last group node
      const lastGroupIdx = next.reduce((acc, n, i) => (n.type === 'group' ? i : acc), -1);
      next.splice(lastGroupIdx + 1, 0, node);
      return { nodes: next, isDirty: true };
    });
  },
  toggleLock: (ids) => {
    get().pushUndo();
    set((s) => {
      // If any selected node is unlocked, lock all; otherwise unlock all
      const targetNodes = s.nodes.filter((n) => ids.includes(n.id));
      const anyUnlocked = targetNodes.some((n) => !n.locked);
      return {
        nodes: s.nodes.map((n) =>
          ids.includes(n.id) ? { ...n, locked: anyUnlocked } as CanvasNode : n,
        ),
        isDirty: true,
      };
    });
  },

  applyLayout: (layoutFn) => {
    get().pushUndo();
    const { nodes, edges } = get();
    const result = layoutFn(nodes, edges);
    if (result instanceof Promise) {
      result.then((newNodes) => set({ nodes: newNodes, isDirty: true }));
    } else {
      set({ nodes: result, isDirty: true });
    }
  },
}));

// Expose store for e2e testing
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__ZUSTAND_CANVAS_STORE__ = useCanvasStore;
}
