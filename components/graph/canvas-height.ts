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
