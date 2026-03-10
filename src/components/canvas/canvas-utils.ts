import type { EdgeSide } from '../../types/canvas';

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
