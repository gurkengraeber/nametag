import { describe, it, expect } from 'vitest';
import { shouldZoomOnWheel, canvasTouchAction } from '../../../components/graph/interaction';
import {
  computeCompactHeight,
  COMPACT_MIN_HEIGHT,
  COMPACT_MAX_HEIGHT,
} from '../../../components/graph/canvas-height';

describe('shouldZoomOnWheel', () => {
  it('lets a plain wheel scroll the page in an embedded graph', () => {
    expect(shouldZoomOnWheel({ ctrlKey: false, metaKey: false }, false)).toBe(false);
  });

  it('zooms with Ctrl, Cmd or a trackpad pinch (ctrlKey)', () => {
    expect(shouldZoomOnWheel({ ctrlKey: true, metaKey: false }, false)).toBe(true);
    expect(shouldZoomOnWheel({ ctrlKey: false, metaKey: true }, false)).toBe(true);
  });

  it('always zooms in full screen', () => {
    expect(shouldZoomOnWheel({ ctrlKey: false, metaKey: false }, true)).toBe(true);
  });
});

describe('canvasTouchAction', () => {
  it('allows vertical page scrolling on embedded graphs only', () => {
    expect(canvasTouchAction(false)).toBe('pan-y');
    expect(canvasTouchAction(true)).toBe('none');
  });
});

describe('computeCompactHeight', () => {
  it('stays small for a person with few connections', () => {
    expect(computeCompactHeight(1)).toBe(COMPACT_MIN_HEIGHT);
    expect(computeCompactHeight(3)).toBe(COMPACT_MIN_HEIGHT);
  });

  it('grows with the number of nodes', () => {
    expect(computeCompactHeight(12)).toBeGreaterThan(computeCompactHeight(6));
  });

  it('never exceeds the maximum', () => {
    expect(computeCompactHeight(500)).toBe(COMPACT_MAX_HEIGHT);
  });

  it('copes with invalid input', () => {
    expect(computeCompactHeight(Number.NaN)).toBe(COMPACT_MIN_HEIGHT);
    expect(computeCompactHeight(-3)).toBe(COMPACT_MIN_HEIGHT);
  });
});
