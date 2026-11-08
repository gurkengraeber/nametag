// components/graph/fit-view.ts

export interface FitNode {
  x?: number;
  y?: number;
  isCenter?: boolean;
  /**
   * True for a node without any edge. Such nodes only feel the repulsion of
   * the others and drift far away, so they do not count when choosing the zoom
   * (unless nothing else is left).
   */
  loose?: boolean;
}

export interface FitViewOptions {
  width: number;
  height: number;
  /** Space kept free around the outermost node (room for its label). */
  padding?: number;
  minScale?: number;
  maxScale?: number;
  /**
   * Share of the nodes that must end up in view. Loose nodes without any
   * connection drift far out and would otherwise shrink the whole network to a
   * speck, so the farthest few are left to the user to zoom out for.
   */
  coverage?: number;
}

export interface FitTransform {
  x: number;
  y: number;
  k: number;
}

export const FIT_PADDING = 56;
export const FIT_MIN_SCALE = 0.25;
export const FIT_MAX_SCALE = 1;
export const FIT_COVERAGE = 0.9;
// Below this many nodes every node is brought into view
const FIT_COVERAGE_MIN_NODES = 20;

function reachOf(distances: number[], coverage: number): number {
  const sorted = [...distances].sort((a, b) => a - b);
  if (sorted.length < FIT_COVERAGE_MIN_NODES) return sorted[sorted.length - 1] ?? 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * coverage) - 1);
  return sorted[index];
}

/**
 * Transform that puts the "you" node in the middle of the canvas and, as far
 * as the minimum scale allows, brings (nearly) every other node into view.
 *
 * Without a center node (or without any positioned node) the view is anchored
 * on the middle of the bounding box, or left at the identity.
 */
export function computeFitTransform(
  nodes: readonly FitNode[],
  {
    width,
    height,
    padding = FIT_PADDING,
    minScale = FIT_MIN_SCALE,
    maxScale = FIT_MAX_SCALE,
    coverage = FIT_COVERAGE,
  }: FitViewOptions,
): FitTransform {
  const positioned = nodes.filter(
    (n): n is FitNode & { x: number; y: number } =>
      typeof n.x === 'number' && Number.isFinite(n.x) &&
      typeof n.y === 'number' && Number.isFinite(n.y),
  );
  if (positioned.length === 0 || width <= 0 || height <= 0) {
    return { x: 0, y: 0, k: 1 };
  }

  const center = positioned.find((n) => n.isCenter);
  let ax: number;
  let ay: number;
  if (center) {
    ax = center.x;
    ay = center.y;
  } else {
    const xs = positioned.map((n) => n.x);
    const ys = positioned.map((n) => n.y);
    ax = (Math.min(...xs) + Math.max(...xs)) / 2;
    ay = (Math.min(...ys) + Math.max(...ys)) / 2;
  }

  const linked = positioned.filter((n) => !n.loose);
  const measured = linked.length > 0 ? linked : positioned;
  const reachX = reachOf(measured.map((n) => Math.abs(n.x - ax)), coverage);
  const reachY = reachOf(measured.map((n) => Math.abs(n.y - ay)), coverage);

  const roomX = Math.max(width / 2 - padding, 1);
  const roomY = Math.max(height / 2 - padding, 1);
  const fitX = reachX > 0 ? roomX / reachX : Infinity;
  const fitY = reachY > 0 ? roomY / reachY : Infinity;
  const k = Math.min(maxScale, Math.max(minScale, Math.min(fitX, fitY)));

  return { x: width / 2 - k * ax, y: height / 2 - k * ay, k };
}
