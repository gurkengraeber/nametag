import { describe, it, expect } from 'vitest';
import { expiryForPreset, isCustomDateMissing } from '@/components/settings/apiTokenExpiry';

const now = new Date('2026-01-10T12:00:00.000Z');

describe('expiryForPreset', () => {
  it('returns null for never', () => {
    expect(expiryForPreset('never', '', now)).toBeNull();
  });

  it('adds the preset number of days', () => {
    expect(expiryForPreset('days30', '', now)).toBe('2026-02-09T12:00:00.000Z');
    expect(expiryForPreset('days90', '', now)).toBe('2026-04-10T12:00:00.000Z');
    expect(expiryForPreset('year1', '', now)).toBe('2027-01-10T12:00:00.000Z');
  });

  it('uses the chosen date for custom and ignores garbage', () => {
    expect(expiryForPreset('custom', '2026-12-31', now)).toBe(new Date(2026, 11, 31, 23, 59, 59, 999).toISOString());
    expect(expiryForPreset('custom', 'nope', now)).toBeNull();
    expect(expiryForPreset('custom', '', now)).toBeNull();
  });
});

describe('isCustomDateMissing', () => {
  it('is only true for custom without a usable date', () => {
    expect(isCustomDateMissing('custom', '')).toBe(true);
    expect(isCustomDateMissing('custom', '2026-12-31', now)).toBe(false);
    expect(isCustomDateMissing('never', '')).toBe(false);
  });

  it('counts today as usable until it is over, but not an earlier day', () => {
    const evening = new Date(2026, 0, 10, 20, 0);
    expect(isCustomDateMissing('custom', '2026-01-10', evening)).toBe(false);
    expect(isCustomDateMissing('custom', '2026-01-09', evening)).toBe(true);
  });
});
