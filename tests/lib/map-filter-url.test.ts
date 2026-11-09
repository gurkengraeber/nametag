import { describe, it, expect } from 'vitest';
import { EMPTY_MAP_FILTERS } from '../../lib/map/filter-markers';
import { filtersFromParams, filtersToParams, hasMapParams, serializeFilters } from '../../lib/map/filter-url';

describe('map filter URL helpers', () => {
  it('round-trips every filter', () => {
    const filters = {
      query: 'ali',
      groupId: 'g1',
      relationshipId: 'none',
      lastContact: 'over6m',
      city: 'Oslo',
      region: '',
      country: '',
    };
    const params = filtersToParams(filters);
    expect(params.toString()).toBe('q=ali&group=g1&rel=none&contact=over6m&city=Oslo');
    expect(filtersFromParams(params)).toEqual(filters);
  });

  it('reads an empty URL as empty filters', () => {
    expect(filtersFromParams(new URLSearchParams())).toEqual(EMPTY_MAP_FILTERS);
  });

  it('drops an unknown last contact value', () => {
    expect(filtersFromParams(new URLSearchParams('contact=whenever')).lastContact).toBe('');
  });

  it('knows which URLs carry map parameters', () => {
    expect(hasMapParams(new URLSearchParams())).toBe(false);
    expect(hasMapParams(new URLSearchParams('focus=addr_1'))).toBe(true);
    expect(hasMapParams(new URLSearchParams('rel=x'))).toBe(true);
    expect(hasMapParams(new URLSearchParams('other=1'))).toBe(false);
  });

  it('serializes filters to a comparable key', () => {
    expect(serializeFilters(EMPTY_MAP_FILTERS)).toBe('||||||');
    expect(serializeFilters({ ...EMPTY_MAP_FILTERS, groupId: 'g1' })).not.toBe(serializeFilters(EMPTY_MAP_FILTERS));
  });
});
