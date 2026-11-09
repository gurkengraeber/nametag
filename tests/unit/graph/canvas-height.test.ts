import { describe, it, expect } from 'vitest';
import {
  computeCanvasHeight,
  CANVAS_BOTTOM_GAP,
  CANVAS_MIN_HEIGHT,
} from '../../../components/graph/canvas-height';

describe('computeCanvasHeight', () => {
  it('fills the screen below the canvas top, minus the bottom gap', () => {
    expect(computeCanvasHeight({ viewportHeight: 900, top: 200 })).toBe(900 - 200 - CANVAS_BOTTOM_GAP);
  });

  it('never gets smaller than the minimum on small windows', () => {
    expect(computeCanvasHeight({ viewportHeight: 400, top: 300 })).toBe(CANVAS_MIN_HEIGHT);
  });

  it('falls back to the minimum for invalid numbers', () => {
    expect(computeCanvasHeight({ viewportHeight: NaN, top: 0 })).toBe(CANVAS_MIN_HEIGHT);
  });

  it('honors custom gap and minimum', () => {
    expect(computeCanvasHeight({ viewportHeight: 800, top: 100, bottomGap: 20, minHeight: 100 })).toBe(680);
  });
});
