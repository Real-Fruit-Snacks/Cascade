import type { CanvasNode, CanvasEdge } from '../../types/canvas';
import { useSettingsStore } from '../../stores/settings-store';

const DEFAULT_GRID = 20;
const PAD_X = 40;
const PAD_Y = 40;

function snap(v: number): number {
  const grid = useSettingsStore.getState().canvasGridSize || DEFAULT_GRID;
  return Math.round(v / grid) * grid;
}

/** Arrange nodes in a grid layout */
export function gridLayout(nodes: CanvasNode[]): CanvasNode[] {
  const nonGroup = nodes.filter((n) => n.type !== 'group');
  const groups = nodes.filter((n) => n.type === 'group');

  const cols = Math.ceil(Math.sqrt(nonGroup.length));
  const maxW = Math.max(...nonGroup.map((n) => n.width), 200);
  const maxH = Math.max(...nonGroup.map((n) => n.height), 100);

  const updated = nonGroup.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      ...node,
      x: snap(col * (maxW + PAD_X)),
      y: snap(row * (maxH + PAD_Y)),
    };
  });

  return [...groups, ...updated];
}

/** Arrange nodes in a tree layout based on edges (top-down) */
export function treeLayout(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] {
  const nonGroup = nodes.filter((n) => n.type !== 'group');
  const groups = nodes.filter((n) => n.type === 'group');

  if (nonGroup.length === 0) return nodes;

  // Build adjacency: parent -> children
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const edge of edges) {
    const from = edge.fromNode;
    const to = edge.toNode;
    if (!children.has(from)) children.set(from, []);
    children.get(from)!.push(to);
    hasParent.add(to);
  }

  // Find roots (nodes with no incoming edges)
  const roots = nonGroup.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
  if (roots.length === 0) roots.push(nonGroup[0].id);

  // BFS to assign levels
  const level = new Map<string, number>();
  const queue = [...roots];
  for (const r of roots) level.set(r, 0);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const lvl = level.get(id) ?? 0;
    for (const child of children.get(id) ?? []) {
      if (!level.has(child)) {
        level.set(child, lvl + 1);
        queue.push(child);
      }
    }
  }

  // Assign level 0 to unvisited nodes
  for (const n of nonGroup) {
    if (!level.has(n.id)) level.set(n.id, 0);
  }

  // Group by level
  const levels = new Map<number, CanvasNode[]>();
  for (const n of nonGroup) {
    const lvl = level.get(n.id) ?? 0;
    if (!levels.has(lvl)) levels.set(lvl, []);
    levels.get(lvl)!.push(n);
  }

  const maxW = Math.max(...nonGroup.map((n) => n.width), 200);
  const maxH = Math.max(...nonGroup.map((n) => n.height), 100);
  const levelGap = maxH + PAD_Y * 2;
  const nodeGap = maxW + PAD_X;

  const updated = new Map<string, CanvasNode>();
  for (const [lvl, lvlNodes] of levels) {
    const totalWidth = lvlNodes.length * nodeGap - PAD_X;
    const startX = -totalWidth / 2;
    for (let i = 0; i < lvlNodes.length; i++) {
      updated.set(lvlNodes[i].id, {
        ...lvlNodes[i],
        x: snap(startX + i * nodeGap),
        y: snap(lvl * levelGap),
      });
    }
  }

  return [...groups, ...nonGroup.map((n) => updated.get(n.id) ?? n)];
}

/** Simple force-directed layout offloaded to a Web Worker */
export async function forceLayout(nodes: CanvasNode[], edges: CanvasEdge[], iterations = 50): Promise<CanvasNode[]> {
  const nonGroup = nodes.filter((n) => n.type !== 'group');
  const groups = nodes.filter((n) => n.type === 'group');

  if (nonGroup.length <= 1) return nodes;

  const gridSize = useSettingsStore.getState().canvasGridSize || DEFAULT_GRID;
  const worker = new Worker(new URL('../../workers/force-layout.worker.ts', import.meta.url), { type: 'module' });

  return new Promise((resolve) => {
    worker.onmessage = (e: MessageEvent<{ nodes: { id: string; x: number; y: number }[] }>) => {
      const posMap = new Map(e.data.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
      worker.terminate();
      resolve([
        ...groups,
        ...nonGroup.map((n) => {
          const p = posMap.get(n.id);
          return p ? { ...n, x: p.x, y: p.y } : n;
        }),
      ]);
    };
    worker.postMessage({
      nodes: nonGroup.map((n) => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height })),
      edges: edges.map((e) => ({ fromNode: e.fromNode, toNode: e.toNode })),
      iterations,
      gridSize,
    });
  });
}
