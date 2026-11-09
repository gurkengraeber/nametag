import { describe, it, expect } from 'vitest';
import { buildAddressesPayload, classifyUnplaced, mostCommonCountry } from '../../lib/map/unplaced';
import type { UnplacedAddress } from '../../lib/map/types';

const street: UnplacedAddress = {
  type: 'work',
  streetLine1: 'Example Road 1',
  streetLine2: null,
  locality: null,
  region: null,
  postalCode: '1234',
  country: null,
};

describe('classifyUnplaced', () => {
  it('no address at all', () => {
    expect(classifyUnplaced([], true)).toBe('noAddress');
  });

  it('pending beats failed while the geocoder still works on something', () => {
    expect(classifyUnplaced([{ geocodeStatus: 'failed' }, { geocodeStatus: 'pending' }], true)).toBe('pending');
    expect(classifyUnplaced([{ geocodeStatus: null }], true)).toBe('pending');
  });

  it('failed when every address was tried', () => {
    expect(classifyUnplaced([{ geocodeStatus: 'failed' }], true)).toBe('failed');
    expect(classifyUnplaced([{ geocodeStatus: 'success' }], true)).toBe('failed');
  });

  it('disabled when the user turned locating off', () => {
    expect(classifyUnplaced([{ geocodeStatus: null }], false)).toBe('disabled');
    expect(classifyUnplaced([{ geocodeStatus: 'disabled' }], true)).toBe('disabled');
  });
});

describe('buildAddressesPayload', () => {
  it('returns null when both fields are empty', () => {
    expect(buildAddressesPayload([], '  ', '')).toBeNull();
  });

  it('creates a home address for someone without any', () => {
    expect(buildAddressesPayload([], ' Oslo ', 'NO')).toEqual([
      {
        type: 'home',
        streetLine1: null,
        streetLine2: null,
        locality: 'Oslo',
        region: null,
        postalCode: null,
        country: 'NO',
      },
    ]);
  });

  it('keeps the other parts of an existing address and all further addresses', () => {
    const other: UnplacedAddress = { ...street, type: 'home', streetLine1: 'Other 2' };
    const result = buildAddressesPayload([street, other], 'Bergen', 'NO');
    expect(result).toEqual([{ ...street, locality: 'Bergen', country: 'NO' }, other]);
  });

  it('keeps an existing value when only one field is given', () => {
    const withCountry = { ...street, country: 'SE' };
    expect(buildAddressesPayload([withCountry], 'Lund', '')).toEqual([{ ...withCountry, locality: 'Lund' }]);
  });
});

describe('mostCommonCountry', () => {
  it('picks the most frequent code', () => {
    expect(mostCommonCountry(['DE', 'NO', 'DE', null])).toBe('DE');
  });

  it('is empty without data and breaks ties alphabetically', () => {
    expect(mostCommonCountry([])).toBe('');
    expect(mostCommonCountry(['NO', 'DE'])).toBe('DE');
  });
});
