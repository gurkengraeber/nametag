import { describe, it, expect, beforeEach } from 'vitest';
import { EMPTY_MAP_FILTERS } from '../../lib/map/filter-markers';
import {
  filtersKey,
  parseStoredFilters,
  parseStoredView,
  readStoredFilters,
  readStoredView,
  viewKey,
  writeStoredFilters,
  writeStoredView,
} from '../../lib/map/view-storage';

describe('map view storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('namespaces the keys with the account id', () => {
    expect(viewKey('u1')).toBe('nametag:map:u1:view');
    expect(filtersKey('u1')).toBe('nametag:map:u1:filters');
  });

  it('round-trips the camera', () => {
    writeStoredView('u1', { longitude: 10.5, latitude: 59.9, zoom: 7 });
    expect(readStoredView('u1')).toEqual({ longitude: 10.5, latitude: 59.9, zoom: 7 });
  });

  it('does not hand one account the view of another', () => {
    writeStoredView('u1', { longitude: 10.5, latitude: 59.9, zoom: 7 });
    expect(readStoredView('u2')).toBeNull();
    // Even if the value is copied under the other account's key, the embedded id is checked.
    window.localStorage.setItem(viewKey('u2'), window.localStorage.getItem(viewKey('u1')) ?? '');
    expect(readStoredView('u2')).toBeNull();
  });

  it('rejects broken or out of range views', () => {
    expect(parseStoredView(null, 'u1')).toBeNull();
    expect(parseStoredView('{', 'u1')).toBeNull();
    expect(parseStoredView(JSON.stringify({ userId: 'u1', longitude: 10, latitude: 99, zoom: 3 }), 'u1')).toBeNull();
    expect(parseStoredView(JSON.stringify({ userId: 'u1', longitude: 10, latitude: 50, zoom: 'x' }), 'u1')).toBeNull();
  });

  it('stores filter values but never the search text', () => {
    writeStoredFilters('u1', { ...EMPTY_MAP_FILTERS, query: 'Alice', groupId: 'g1', lastContact: 'over6m' });
    const raw = window.localStorage.getItem(filtersKey('u1')) ?? '';
    expect(raw).not.toContain('Alice');
    expect(readStoredFilters('u1')).toEqual({ ...EMPTY_MAP_FILTERS, groupId: 'g1', lastContact: 'over6m' });
  });

  it('ignores filters stored for another account or with bad values', () => {
    writeStoredFilters('u1', { ...EMPTY_MAP_FILTERS, groupId: 'g1' });
    expect(readStoredFilters('u2')).toBeNull();
    const raw = JSON.stringify({ userId: 'u1', groupId: 5, lastContact: 'whenever', city: 'Oslo' });
    expect(parseStoredFilters(raw, 'u1')).toEqual({ ...EMPTY_MAP_FILTERS, city: 'Oslo' });
  });

  it('keeps working when storage throws', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(readStoredView('u1')).toBeNull();
      expect(() => writeStoredView('u1', { longitude: 1, latitude: 1, zoom: 1 })).not.toThrow();
      expect(readStoredFilters('u1')).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});
