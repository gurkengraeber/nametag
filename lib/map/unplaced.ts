import type { UnplacedAddress, UnplacedReason } from './types';

export interface AddressStatus {
  geocodeStatus: string | null;
}

/**
 * Why a contact without any marker is not on the map. `geocodingEnabled` is
 * the user's privacy toggle: while it is off nothing is ever located, so the
 * stored per-address status says nothing.
 */
export function classifyUnplaced(
  addresses: readonly AddressStatus[],
  geocodingEnabled: boolean
): UnplacedReason {
  if (addresses.length === 0) return 'noAddress';
  if (!geocodingEnabled) return 'disabled';
  if (addresses.some((a) => a.geocodeStatus === null || a.geocodeStatus === 'pending')) return 'pending';
  if (addresses.some((a) => a.geocodeStatus === 'disabled') && !addresses.some((a) => a.geocodeStatus === 'failed')) {
    return 'disabled';
  }
  return 'failed';
}

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Builds the full address list to send to the person update route when the
 * user types a city and country for someone without a place. That route
 * replaces ALL addresses of a person, so the existing ones must be sent along.
 *
 * - No address yet: a new "home" address with just city and country.
 * - Otherwise: the first address gets the city and country (its street and
 *   other parts stay), every other address is untouched. Every address of a
 *   contact without a marker is unlocated, so the first one is as good as any.
 *
 * Returns null when both city and country are empty.
 */
export function buildAddressesPayload(
  existing: readonly UnplacedAddress[],
  city: string,
  country: string
): UnplacedAddress[] | null {
  const locality = clean(city);
  const countryCode = clean(country);
  if (!locality && !countryCode) return null;

  if (existing.length === 0) {
    return [
      {
        type: 'home',
        streetLine1: null,
        streetLine2: null,
        locality,
        region: null,
        postalCode: null,
        country: countryCode,
      },
    ];
  }

  return existing.map((address, index) =>
    index === 0
      ? {
          ...address,
          locality: locality ?? address.locality,
          country: countryCode ?? address.country,
        }
      : { ...address }
  );
}

/** The country code used most often among the given codes, to preselect it in the quick entry. */
export function mostCommonCountry(countryCodes: ReadonlyArray<string | null>): string {
  const counts = new Map<string, number>();
  for (const code of countryCodes) {
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount || (count === bestCount && code < best)) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}
