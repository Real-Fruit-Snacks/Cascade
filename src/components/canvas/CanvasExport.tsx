import { useCanvasStore } from '../../stores/canvas-store';
import { useSettingsStore } from '../../stores/settings-store';
import { CANVAS_COLORS } from '../../types/canvas';
import type { CanvasNode } from '../../types/canvas';
import { anchorPoint, sideDirection, getComputedColor } from './canvas-utils';

function getBounds(nodes: CanvasNode[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }
  return { minX, minY, maxX, maxY };
}

const CTRL_OFFSET = 80;

export async function exportCanvasToPNG(scale = 2): Promise<Blob> {
  const { nodes, edges } = useCanvasStore.getState();
  if (nodes.length === 0) throw new Error('Nothing to export');

  const PAD = 40;
  const { minX, minY, maxX, maxY } = getBounds(nodes);
  const w = (maxX - minX + PAD * 2) * scale;
  const h = (maxY - minY + PAD * 2) * scale;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Background
  const showBg = useSettingsStore.getState().canvasExportBackground;
  if (showBg) {
    ctx.fillStyle = getComputedColor('var(--ctp-base)');
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-minX + PAD, -minY + PAD);

  // Draw edges
  for (const edge of edges) {
    const fromNode = nodes.find((n) => n.id === edge.fromNode);
    const toNode = nodes.find((n) => n.id === edge.toNode);
    if (!fromNode || !toNode) continue;

    const from = anchorPoint(fromNode, edge.fromSide);
    const to = anchorPoint(toNode, edge.toSide);
    const fromDir = sideDirection(edge.fromSide);
    const toDir = sideDirection(edge.toSide);

    const color = edge.color ? getComputedColor(CANVAS_COLORS[edge.color]) : getComputedColor('var(--ctp-overlay0)');
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    if (edge.lineStyle === 'dashed') ctx.setLineDash([8, 4]);
    else if (edge.lineStyle === 'dotted') ctx.setLineDash([2, 4]);
    else ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(
      from.x + fromDir.dx * CTRL_OFFSET,
      from.y + fromDir.dy * CTRL_OFFSET,
      to.x + toDir.dx * CTRL_OFFSET,
      to.y + toDir.dy * CTRL_OFFSET,
      to.x,
      to.y,
    );
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw arrow at toEnd (default)
    const toEnd = edge.toEnd ?? 'arrow';
    if (toEnd === 'arrow') {
      drawArrow(ctx, to.x + toDir.dx * CTRL_OFFSET, to.y + toDir.dy * CTRL_OFFSET, to.x, to.y, color);
    }
    const fromEnd = edge.fromEnd ?? 'none';
    if (fromEnd === 'arrow') {
      drawArrow(ctx, from.x + fromDir.dx * CTRL_OFFSET, from.y + fromDir.dy * CTRL_OFFSET, from.x, from.y, color);
    }

    // Edge label
    if (edge.label) {
      const cp1x = from.x + fromDir.dx * CTRL_OFFSET;
      const cp1y = from.y + fromDir.dy * CTRL_OFFSET;
      const cp2x = to.x + toDir.dx * CTRL_OFFSET;
      const cp2y = to.y + toDir.dy * CTRL_OFFSET;
      const t = 0.5;
      const midX = (1-t)**3 * from.x + 3*(1-t)**2*t * cp1x + 3*(1-t)*t**2 * cp2x + t**3 * to.x;
      const midY = (1-t)**3 * from.y + 3*(1-t)**2*t * cp1y + 3*(1-t)*t**2 * cp2y + t**3 * to.y;
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = getComputedColor('var(--ctp-text)');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const metrics = ctx.measureText(edge.label);
      const pad = 4;
      ctx.fillStyle = getComputedColor('var(--ctp-base)');
      ctx.fillRect(midX - metrics.width / 2 - pad, midY - 8 - pad, metrics.width + pad * 2, 16 + pad * 2);
      ctx.fillStyle = getComputedColor('var(--ctp-text)');
      ctx.fillText(edge.label, midX, midY);
    }
  }

  // Draw nodes
  for (const node of nodes) {
    const nodeColor = node.color ? getComputedColor(CANVAS_COLORS[node.color]) : undefined;

    if (node.type === 'group') {
      ctx.strokeStyle = nodeColor || getComputedColor('var(--ctp-surface1)');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(node.x, node.y, node.width, node.height);
      ctx.setLineDash([]);
      if (node.label) {
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = getComputedColor('var(--ctp-subtext0)');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x + 8, node.y + 4);
      }
      continue;
    }

    // Card background
    ctx.fillStyle = getComputedColor('var(--ctp-surface0)');
    roundRect(ctx, node.x, node.y, node.width, node.height, 8);
    ctx.fill();

    // Color stripe on left
    if (nodeColor) {
      ctx.fillStyle = nodeColor;
      ctx.fillRect(node.x, node.y + 4, 3, node.height - 8);
    }

    // Card border
    ctx.strokeStyle = getComputedColor('var(--ctp-surface1)');
    ctx.lineWidth = 1;
    roundRect(ctx, node.x, node.y, node.width, node.height, 8);
    ctx.stroke();

    // Card content text
    ctx.fillStyle = getComputedColor('var(--ctp-text)');
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let label = '';
    if (node.type === 'text') label = node.text || 'Empty card';
    else if (node.type === 'file') label = node.file;
    else if (node.type === 'link') label = node.url;

    // Truncate and wrap text
    const maxW = node.width - 24;
    const lines = wrapText(ctx, label, maxW, 8);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], node.x + 12, node.y + 12 + i * 18);
    }
  }

  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export'));
    }, 'image/png');
  });
}

function drawArrow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const size = 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) {
        lines[lines.length - 1] += '...';
        return lines;
      }
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function exportCanvasToSVG(): Promise<string> {
  const { nodes, edges } = useCanvasStore.getState();
  if (nodes.length === 0) throw new Error('Nothing to export');

  const PAD = 40;
  const { minX, minY, maxX, maxY } = getBounds(nodes);
  const w = maxX - minX + PAD * 2;
  const h = maxY - minY + PAD * 2;
  const ox = -minX + PAD;
  const oy = -minY + PAD;

  const bgColor = getComputedColor('var(--ctp-base)');
  const textColor = getComputedColor('var(--ctp-text)');
  const surfaceColor = getComputedColor('var(--ctp-surface0)');
  const borderColor = getComputedColor('var(--ctp-surface1)');

  const showBgSvg = useSettingsStore.getState().canvasExportBackground;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
  if (showBgSvg) {
    svg += `<rect width="${w}" height="${h}" fill="${bgColor}"/>\n`;
  }
  svg += `<g transform="translate(${ox},${oy})">\n`;

  // Edges
  for (const edge of edges) {
    const fromNode = nodes.find((n) => n.id === edge.fromNode);
    const toNode = nodes.find((n) => n.id === edge.toNode);
    if (!fromNode || !toNode) continue;

    const from = anchorPoint(fromNode, edge.fromSide);
    const to = anchorPoint(toNode, edge.toSide);
    const fromDir = sideDirection(edge.fromSide);
    const toDir = sideDirection(edge.toSide);
    const color = edge.color ? getComputedColor(CANVAS_COLORS[edge.color]) : getComputedColor('var(--ctp-overlay0)');

    let dashArray = '';
    if (edge.lineStyle === 'dashed') dashArray = ' stroke-dasharray="8 4"';
    else if (edge.lineStyle === 'dotted') dashArray = ' stroke-dasharray="2 4"';

    svg += `<path d="M${from.x},${from.y} C${from.x + fromDir.dx * CTRL_OFFSET},${from.y + fromDir.dy * CTRL_OFFSET} ${to.x + toDir.dx * CTRL_OFFSET},${to.y + toDir.dy * CTRL_OFFSET} ${to.x},${to.y}" fill="none" stroke="${color}" stroke-width="2"${dashArray}/>\n`;
  }

  // Nodes
  for (const node of nodes) {
    if (node.type === 'group') {
      svg += `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="none" stroke="${borderColor}" stroke-dasharray="4 4" rx="4"/>\n`;
      if (node.label) {
        svg += `<text x="${node.x + 8}" y="${node.y + 16}" fill="${getComputedColor('var(--ctp-subtext0)')}" font-size="12" font-family="Inter, sans-serif">${escapeXml(node.label)}</text>\n`;
      }
      continue;
    }

    svg += `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${surfaceColor}" stroke="${borderColor}" rx="8"/>\n`;

    let label = '';
    if (node.type === 'text') label = node.text || 'Empty card';
    else if (node.type === 'file') label = node.file;
    else if (node.type === 'link') label = node.url;

    // Truncate for SVG
    if (label.length > 60) label = label.slice(0, 57) + '...';
    svg += `<text x="${node.x + 12}" y="${node.y + 24}" fill="${textColor}" font-size="13" font-family="Inter, sans-serif">${escapeXml(label)}</text>\n`;
  }

  svg += '</g>\n</svg>';
  return svg;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function downloadExport(format: 'png' | 'svg') {
  try {
    let blob: Blob;
    let filename: string;

    if (format === 'png') {
      blob = await exportCanvasToPNG(2);
      filename = 'canvas-export.png';
    } else {
      const svgStr = await exportCanvasToSVG();
      blob = new Blob([svgStr], { type: 'image/svg+xml' });
      filename = 'canvas-export.svg';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export failed:', err);
  }
}
