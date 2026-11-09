import { describe, it, expect } from 'vitest';
import { addIds, isFrameBigEnough, personIdsInRect, toggleIds } from '../../lib/map/selection';

describe('toggleIds', () => {
  it('adds ids that are not selected yet', () => {
    expect([...toggleIds(new Set(['a']), ['b'])].sort()).toEqual(['a', 'b']);
  });

  it('removes ids when all of them are selected', () => {
    expect([...toggleIds(new Set(['a', 'b']), ['a', 'b'])]).toEqual([]);
  });

  it('selects the rest when only some are selected', () => {
    expect([...toggleIds(new Set(['a']), ['a', 'b'])].sort()).toEqual(['a', 'b']);
  });

  it('does not change the original set or react to an empty list', () => {
    const original = new Set(['a']);
    toggleIds(original, ['b']);
    expect([...original]).toEqual(['a']);
    expect([...toggleIds(original, [])]).toEqual(['a']);
  });
});

describe('addIds', () => {
  it('never removes anything', () => {
    expect([...addIds(new Set(['a']), ['a', 'b'])].sort()).toEqual(['a', 'b']);
  });
});

describe('frame selection', () => {
  const points = [
    { personId: 'p1', x: 10, y: 10 },
    { personId: 'p2', x: 50, y: 50 },
    { personId: 'p2', x: 60, y: 60 },
    { personId: 'p3', x: 200, y: 200 },
  ];

  it('returns the people inside the frame once each', () => {
    expect(personIdsInRect(points, { x1: 0, y1: 0, x2: 100, y2: 100 }).sort()).toEqual(['p1', 'p2']);
  });

  it('works for a frame dragged from bottom right to top left', () => {
    expect(personIdsInRect(points, { x1: 100, y1: 100, x2: 40, y2: 40 })).toEqual(['p2']);
  });

  it('treats a tiny drag as a tap', () => {
    expect(isFrameBigEnough({ x1: 10, y1: 10, x2: 13, y2: 12 })).toBe(false);
    expect(isFrameBigEnough({ x1: 10, y1: 10, x2: 40, y2: 12 })).toBe(true);
  });
});
