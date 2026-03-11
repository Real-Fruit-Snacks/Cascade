import type { EdgeSide, CanvasNode } from '../../types/canvas';
import { BEZIER_SAMPLE_COUNT, type ClipboardData } from './canvas-types';

/** Compute the anchor point (world coords) for a given side on a node */
export function anchorPoint(
  node: { x: number; y: number; width: number; height: number },
  side: EdgeSide,
): { x: number; y: number } {
  switch (side) {
    case 'top':    return { x: node.x + node.width / 2, y: node.y };
    case 'bottom': return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':   return { x: node.x, y: node.y + node.height / 2 };
    case 'right':  return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}

/** Control point offset direction per side (outward from the node) */
export function sideDirection(side: EdgeSide): { dx: number; dy: number } {
  switch (side) {
    case 'top':    return { dx: 0, dy: -1 };
    case 'bottom': return { dx: 0, dy: 1 };
    case 'left':   return { dx: -1, dy: 0 };
    case 'right':  return { dx: 1, dy: 0 };
  }
}

/** Resolve a CSS var string like "var(--ctp-red)" to its computed color value */
export function resolveCssVar(cssVar: string): string {
  const match = cssVar.match(/var\((--[^)]+)\)/);
  if (!match) return cssVar;
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
}

/** Extract a computed color from a CSS variable expression like "var(--ctp-xxx)" */
export function getComputedColor(cssVar: string): string {
  const match = cssVar.match(/var\((--[^)]+)\)/);
  if (match) {
    return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || '#cdd6f4';
  }
  return cssVar;
}

// Clipboard helpers
export async function writeCanvasClipboard(data: ClipboardData): Promise<void> {
  try {
    await navigator.clipboard.writeText(JSON.stringify({ __cascadeCanvas: true, ...data }));
  } catch { /* clipboard access denied */ }
}

export async function readCanvasClipboard(): Promise<ClipboardData | null> {
  try {
    const raw = await navigator.clipboard.readText();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.__cascadeCanvas && Array.isArray(parsed.nodes)) return parsed;
  } catch { /* not canvas data or clipboard access denied */ }
  return null;
}

// Bezier sampling
export function bezierPoint(
  p0x: number, p0y: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  p1x: number, p1y: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * p1x,
    y: mt * mt * mt * p0y + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * p1y,
  };
}

// Hit-test a screen point against a bezier curve
export function isNearBezier(
  mx: number, my: number,
  p0x: number, p0y: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  p1x: number, p1y: number,
  hitRadius: number,
): boolean {
  for (let i = 0; i <= BEZIER_SAMPLE_COUNT; i++) {
    const t = i / BEZIER_SAMPLE_COUNT;
    const pt = bezierPoint(p0x, p0y, cp1x, cp1y, cp2x, cp2y, p1x, p1y, t);
    const dx = mx - pt.x;
    const dy = my - pt.y;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return true;
  }
  return false;
}

// Determine which side of a node a world point is closest to
export function closestSide(node: CanvasNode, wx: number, wy: number): EdgeSide {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = wx - cx;
  const dy = wy - cy;
  const nx = dx / (node.width / 2);
  const ny = dy / (node.height / 2);
  if (Math.abs(nx) >= Math.abs(ny)) {
    return nx >= 0 ? 'right' : 'left';
  } else {
    return ny >= 0 ? 'bottom' : 'top';
  }
}
