import { describe, it, expect } from 'vitest';
import { pickFreshColor } from '../../lib/color-choice';
import { PRESET_COLORS } from '../../lib/colors';

describe('pickFreshColor', () => {
  it('starts with the first suggestion', () => {
    expect(pickFreshColor([])).toBe(PRESET_COLORS[0]);
  });

  it('skips colors that are already used, ignoring case and empty values', () => {
    expect(pickFreshColor([PRESET_COLORS[0].toLowerCase(), null, undefined])).toBe(PRESET_COLORS[1]);
    expect(pickFreshColor([PRESET_COLORS[0], PRESET_COLORS[1]])).toBe(PRESET_COLORS[2]);
  });

  it('cycles when every suggestion is taken', () => {
    expect(pickFreshColor([...PRESET_COLORS])).toBe(PRESET_COLORS[0]);
    expect(pickFreshColor([...PRESET_COLORS, '#000000'])).toBe(PRESET_COLORS[1]);
  });

  it('works with a custom palette', () => {
    expect(pickFreshColor(['#111111'], ['#111111', '#222222'])).toBe('#222222');
  });
});
