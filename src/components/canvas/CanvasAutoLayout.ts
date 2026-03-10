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

/** Simple force-directed layout (limited iterations for speed) */
export function forceLayout(nodes: CanvasNode[], edges: CanvasEdge[], iterations = 50): CanvasNode[] {
  const nonGroup = nodes.filter((n) => n.type !== 'group');
  const groups = nodes.filter((n) => n.type === 'group');

  if (nonGroup.length <= 1) return nodes;

  // Initialize positions
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nonGroup) {
    pos.set(n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 });
  }

  const REPULSION = 50000;
  const ATTRACTION = 0.01;
  const DAMPING = 0.9;
  const vel = new Map<string, { vx: number; vy: number }>();
  for (const n of nonGroup) vel.set(n.id, { vx: 0, vy: 0 });

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < nonGroup.length; i++) {
      for (let j = i + 1; j < nonGroup.length; j++) {
        const a = pos.get(nonGroup[i].id)!;
        const b = pos.get(nonGroup[j].id)!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 10);
        const force = REPULSION / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        vel.get(nonGroup[i].id)!.vx -= dx;
        vel.get(nonGroup[i].id)!.vy -= dy;
        vel.get(nonGroup[j].id)!.vx += dx;
        vel.get(nonGroup[j].id)!.vy += dy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = pos.get(edge.fromNode);
      const b = pos.get(edge.toNode);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fx = dx * ATTRACTION;
      const fy = dy * ATTRACTION;
      if (vel.has(edge.fromNode)) {
        vel.get(edge.fromNode)!.vx += fx;
        vel.get(edge.fromNode)!.vy += fy;
      }
      if (vel.has(edge.toNode)) {
        vel.get(edge.toNode)!.vx -= fx;
        vel.get(edge.toNode)!.vy -= fy;
      }
    }

    // Apply velocities
    for (const n of nonGroup) {
      const v = vel.get(n.id)!;
      const p = pos.get(n.id)!;
      p.x += v.vx;
      p.y += v.vy;
      v.vx *= DAMPING;
      v.vy *= DAMPING;
    }
  }

  return [
    ...groups,
    ...nonGroup.map((n) => {
      const p = pos.get(n.id)!;
      return { ...n, x: snap(p.x - n.width / 2), y: snap(p.y - n.height / 2) };
    }),
  ];
}
