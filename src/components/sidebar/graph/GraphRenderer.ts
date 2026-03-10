import { type GraphNode, type GraphLink, type GraphSettings } from './GraphTypes';

export interface DrawParams {
  canvas: HTMLCanvasElement;
  nodes: GraphNode[];
  links: GraphLink[];
  colors: Record<string, string>;
  hoveredNode: GraphNode | null;
  activeFilePath: string | null;
  selectedPath: string | null;
  offset: { x: number; y: number };
  scale: number;
  nodeBaseSize: number;
  nodeColorMap: Map<string, string>;
  settings: GraphSettings;
}

export function drawGraph(params: DrawParams): void {
  const { canvas, nodes, links, colors, hoveredNode, activeFilePath, selectedPath, offset, scale, nodeBaseSize, nodeColorMap, settings } = params;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(scale, scale);

  // Determine active and connected nodes — use selectedPath when on graph tab
  const highlightPath = activeFilePath?.startsWith('__') ? selectedPath : activeFilePath;
  const activeNode = highlightPath
    ? nodes.find((n) => n.filePath === highlightPath) ?? null
    : null;

  const connectedIds = new Set<string>();
  if (activeNode) {
    for (const link of links) {
      const s = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const t = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (s === activeNode.id) connectedIds.add(t);
      if (t === activeNode.id) connectedIds.add(s);
    }
  }

  const hoveredIds = new Set<string>();
  if (hoveredNode) {
    for (const link of links) {
      const s = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const t = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (s === hoveredNode.id) hoveredIds.add(t);
      if (t === hoveredNode.id) hoveredIds.add(s);
    }
  }

  // Draw edges
  for (const link of links) {
    const sNode = link.source as GraphNode;
    const tNode = link.target as GraphNode;
    if (sNode.x == null || sNode.y == null || tNode.x == null || tNode.y == null) continue;

    const isHighlighted =
      (activeNode && (sNode.id === activeNode.id || tNode.id === activeNode.id)) ||
      (hoveredNode && (sNode.id === hoveredNode.id || tNode.id === hoveredNode.id));

    ctx.beginPath();
    ctx.moveTo(sNode.x, sNode.y);
    ctx.lineTo(tNode.x, tNode.y);
    ctx.strokeStyle = isHighlighted
      ? colors['--ctp-overlay1'] + 'cc'
      : colors['--ctp-surface2'] + '66';
    ctx.lineWidth = isHighlighted ? 1.5 : 1;
    ctx.stroke();
  }

  // Draw nodes
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;

    const isActive = activeNode?.id === node.id;
    const isConnected = connectedIds.has(node.id);
    const isHovered = hoveredNode?.id === node.id;
    const isHoveredNeighbor = hoveredIds.has(node.id);

    const radius = Math.max(nodeBaseSize - 2, Math.min(nodeBaseSize + 2, nodeBaseSize + node.connectionCount * 0.8));

    let color: string;
    if (isActive) {
      color = colors['--ctp-accent'];
    } else if (isConnected) {
      color = colors['--ctp-blue'];
    } else if (isHovered) {
      color = colors['--ctp-accent'];
    } else if (isHoveredNeighbor) {
      color = colors['--ctp-blue'];
    } else {
      const mappedVar = nodeColorMap.get(node.filePath);
      color = mappedVar ? colors[mappedVar] || colors['--ctp-overlay1'] : colors['--ctp-overlay1'];
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, isHovered || isActive ? radius + 2 : radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label: always show for active/hovered/neighbors, show all when zoomed in
    const showLabel = isActive || isConnected || isHovered || isHoveredNeighbor || settings.labelsAlways || scale >= 1.5;
    if (showLabel) {
      const label = node.id.replace(/\.md$/i, '');
      const fontSize = Math.max(8, Math.min(12, 10 / Math.sqrt(scale)));
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = isActive || isHovered ? colors['--ctp-subtext0'] : colors['--ctp-subtext0'] + (scale >= 2.5 ? 'ff' : 'aa');
      ctx.textAlign = 'center';
      ctx.fillText(label, node.x, node.y - radius - 4);
    }
  }

  ctx.restore();
}
