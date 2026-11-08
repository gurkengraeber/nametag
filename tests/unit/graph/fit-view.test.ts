import { describe, it, expect } from 'vitest';
import {
  computeFitTransform,
  FIT_COVERAGE,
  FIT_MAX_SCALE,
  FIT_MIN_SCALE,
  FIT_PADDING,
} from '../../../components/graph/fit-view';

const size = { width: 800, height: 600 };

// Screen position of a graph point under a transform
const screenOf = (t: { x: number; y: number; k: number }, x: number, y: number) => ({
  x: x * t.k + t.x,
  y: y * t.k + t.y,
});

describe('computeFitTransform', () => {
  it('returns the identity when no node has a position yet', () => {
    expect(computeFitTransform([{ isCenter: true }, {}], size)).toEqual({ x: 0, y: 0, k: 1 });
    expect(computeFitTransform([], size)).toEqual({ x: 0, y: 0, k: 1 });
  });

  it('returns the identity for an empty canvas', () => {
    const nodes = [{ x: 1, y: 1, isCenter: true }];
    expect(computeFitTransform(nodes, { width: 0, height: 0 })).toEqual({ x: 0, y: 0, k: 1 });
  });

  it('puts the center node in the middle of the canvas', () => {
    const nodes = [
      { x: 1200, y: -300, isCenter: true },
      { x: 1300, y: -250 },
      { x: 1150, y: -380 },
    ];
    const t = computeFitTransform(nodes, size);
    expect(screenOf(t, 1200, -300)).toEqual({ x: 400, y: 300 });
  });

  it('does not zoom in beyond the maximum scale for a small network', () => {
    const nodes = [
      { x: 0, y: 0, isCenter: true },
      { x: 10, y: 10 },
    ];
    expect(computeFitTransform(nodes, size).k).toBe(FIT_MAX_SCALE);
  });

  it('zooms out so that every node and its padding fit', () => {
    const nodes = [
      { x: 0, y: 0, isCenter: true },
      { x: 800, y: 0 },
      { x: 0, y: -600 },
    ];
    const t = computeFitTransform(nodes, size);
    expect(t.k).toBeLessThan(1);
    expect(t.k).toBeGreaterThan(FIT_MIN_SCALE);
    for (const n of nodes) {
      const p = screenOf(t, n.x, n.y);
      expect(p.x).toBeGreaterThanOrEqual(FIT_PADDING - 0.001);
      expect(p.x).toBeLessThanOrEqual(size.width - FIT_PADDING + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(FIT_PADDING - 0.001);
      expect(p.y).toBeLessThanOrEqual(size.height - FIT_PADDING + 0.001);
    }
  });

  it('is limited by the tighter axis', () => {
    // 600 px tall canvas: only 300 - 56 = 244 px of room above and below the center
    const nodes = [
      { x: 0, y: 0, isCenter: true },
      { x: 0, y: 488 },
    ];
    expect(computeFitTransform(nodes, size).k).toBeCloseTo(0.5, 5);
  });

  it('never goes below the minimum scale, even with a far outlier', () => {
    const nodes = [
      { x: 0, y: 0, isCenter: true },
      { x: 100000, y: 100000 },
    ];
    expect(computeFitTransform(nodes, size).k).toBe(FIT_MIN_SCALE);
  });

  it('lets the bulk of a large network decide the zoom, not a few drifting outliers', () => {
    const cluster = Array.from({ length: 30 }, (_, i) => ({
      x: Math.cos(i) * 300,
      y: Math.sin(i) * 200,
    }));
    const outliers = [{ x: 5000, y: 4000 }, { x: -4000, y: 3500 }];
    const center = { x: 0, y: 0, isCenter: true };

    const withOutliers = computeFitTransform([center, ...cluster, ...outliers], size);
    const withoutOutliers = computeFitTransform([center, ...cluster], size);

    expect(withOutliers.k).toBeGreaterThan(withoutOutliers.k * 0.7);
    expect(withOutliers.k).toBeGreaterThan(FIT_MIN_SCALE);
  });

  it('brings every node into view when there are few of them', () => {
    const nodes = [
      { x: 0, y: 0, isCenter: true },
      ...Array.from({ length: 5 }, (_, i) => ({ x: 100 * i, y: 50 })),
      { x: 700, y: 0 },
    ];
    const t = computeFitTransform(nodes, size);
    expect(screenOf(t, 700, 0).x).toBeLessThanOrEqual(size.width - FIT_PADDING + 0.001);
  });

  it('uses a coverage that leaves out only the farthest tenth', () => {
    expect(FIT_COVERAGE).toBe(0.9);
  });

  it('ignores loose nodes without an edge when choosing the zoom', () => {
    const linked = [
      { x: 0, y: 0, isCenter: true },
      { x: 300, y: 100 },
      { x: -250, y: -120 },
    ];
    const loose = Array.from({ length: 10 }, (_, i) => ({ x: 4000 + i, y: 3000, loose: true }));

    const withLoose = computeFitTransform([...linked, ...loose], size);
    const withoutLoose = computeFitTransform(linked, size);

    expect(withLoose).toEqual(withoutLoose);
  });

  it('falls back to all nodes when every node is loose', () => {
    const nodes = [
      { x: 0, y: 0, isCenter: true, loose: true },
      { x: 600, y: 0, loose: true },
    ];
    const t = computeFitTransform(nodes, size);
    expect(t.k).toBeLessThan(1);
    expect(screenOf(t, 0, 0)).toEqual({ x: 400, y: 300 });
  });

  it('anchors on the middle of the bounding box when there is no center node', () => {
    const nodes = [
      { x: 100, y: 100 },
      { x: 300, y: 500 },
    ];
    const t = computeFitTransform(nodes, size);
    expect(screenOf(t, 200, 300)).toEqual({ x: 400, y: 300 });
  });

  it('ignores nodes without a usable position', () => {
    const nodes = [
      { x: 50, y: 50, isCenter: true },
      { x: Number.NaN, y: 10 },
      {},
    ];
    const t = computeFitTransform(nodes, size);
    expect(screenOf(t, 50, 50)).toEqual({ x: 400, y: 300 });
    expect(t.k).toBe(FIT_MAX_SCALE);
  });

  it('honours custom padding', () => {
    const nodes = [
      { x: 0, y: 0, isCenter: true },
      { x: 360, y: 0 },
    ];
    // 400 - 40 = 360 px of room, so the node just fits at k = 1
    expect(computeFitTransform(nodes, { ...size, padding: 40 }).k).toBeCloseTo(1, 5);
    // with the default padding the room is only 344 px
    expect(computeFitTransform(nodes, size).k).toBeCloseTo(344 / 360, 5);
  });
});
