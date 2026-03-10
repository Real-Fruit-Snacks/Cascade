interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutEdge {
  fromNode: string;
  toNode: string;
}

self.onmessage = (e: MessageEvent<{ nodes: LayoutNode[]; edges: LayoutEdge[]; iterations: number; gridSize: number }>) => {
  const { nodes, edges, iterations, gridSize } = e.data;

  const snap = (v: number) => Math.round(v / gridSize) * gridSize;

  // Initialize positions at center of each node
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    pos.set(n.id, { x: n.x + n.width / 2, y: n.y + n.height / 2 });
  }

  const REPULSION = 50000;
  const ATTRACTION = 0.01;
  const DAMPING = 0.9;
  const vel = new Map<string, { vx: number; vy: number }>();
  for (const n of nodes) vel.set(n.id, { vx: 0, vy: 0 });

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos.get(nodes[i].id)!;
        const b = pos.get(nodes[j].id)!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 10);
        const force = REPULSION / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        vel.get(nodes[i].id)!.vx -= dx;
        vel.get(nodes[i].id)!.vy -= dy;
        vel.get(nodes[j].id)!.vx += dx;
        vel.get(nodes[j].id)!.vy += dy;
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
    for (const n of nodes) {
      const v = vel.get(n.id)!;
      const p = pos.get(n.id)!;
      p.x += v.vx;
      p.y += v.vy;
      v.vx *= DAMPING;
      v.vy *= DAMPING;
    }
  }

  const result = nodes.map((n) => {
    const p = pos.get(n.id)!;
    return { id: n.id, x: snap(p.x - n.width / 2), y: snap(p.y - n.height / 2) };
  });

  self.postMessage({ nodes: result });
};
