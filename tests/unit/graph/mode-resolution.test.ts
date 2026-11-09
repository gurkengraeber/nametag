import { describe, it, expect } from 'vitest';
import { resolveGraphMode, AUTO_BUBBLE_THRESHOLD } from '../../../components/graph/mode-resolution';

describe('resolveGraphMode', () => {
  it('defaults to individuals when nothing is chosen and the size is unknown', () => {
    expect(resolveGraphMode(null)).toBe('individuals');
  });

  it('shows small networks as individuals', () => {
    expect(resolveGraphMode(null, AUTO_BUBBLE_THRESHOLD)).toBe('individuals');
  });

  it('opens large networks as group bubbles', () => {
    expect(resolveGraphMode(null, AUTO_BUBBLE_THRESHOLD + 1)).toBe('bubbles');
  });

  it('always honors an explicit choice', () => {
    expect(resolveGraphMode('individuals', 500)).toBe('individuals');
    expect(resolveGraphMode('bubbles', 3)).toBe('bubbles');
  });
});
