export interface CanvasHeightOptions {
  /** Height of the visible window area. */
  viewportHeight: number;
  /** Distance from the top of the page to the top of the canvas. */
  top: number;
  /** Space kept free below the canvas (card padding and page margin). */
  bottomGap?: number;
  minHeight?: number;
}

export const CANVAS_BOTTOM_GAP = 40;
export const CANVAS_MIN_HEIGHT = 320;

/**
 * Height for the dashboard canvas so that it ends at the bottom of the screen:
 * greeting, key figures and network then fit on one screen without scrolling.
 * On very small windows the minimum wins and the page scrolls instead.
 */
export function computeCanvasHeight({
  viewportHeight,
  top,
  bottomGap = CANVAS_BOTTOM_GAP,
  minHeight = CANVAS_MIN_HEIGHT,
}: CanvasHeightOptions): number {
  const free = Math.floor(viewportHeight - top - bottomGap);
  return Number.isFinite(free) ? Math.max(minHeight, free) : minHeight;
}

export const COMPACT_MIN_HEIGHT = 240;
export const COMPACT_MAX_HEIGHT = 440;
const COMPACT_BASE_HEIGHT = 190;
const COMPACT_PER_NODE = 14;

/**
 * Height of the small graph on a person page. Most people have only a handful of
 * connections, so a fixed tall canvas is mostly empty. The height grows with the
 * number of nodes, within sensible limits.
 */
export function computeCompactHeight(nodeCount: number): number {
  const count = Number.isFinite(nodeCount) ? Math.max(0, Math.floor(nodeCount)) : 0;
  return Math.min(COMPACT_MAX_HEIGHT, Math.max(COMPACT_MIN_HEIGHT, COMPACT_BASE_HEIGHT + count * COMPACT_PER_NODE));
}
