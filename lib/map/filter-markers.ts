import type { MapMarker, MapPerson } from './types';
import { matchesLastContactFilter } from './last-contact';
import { matchesSearch } from '@/lib/search';

export interface MapFilterState {
  query: string;
  groupId: string;
  /** "" for everyone, "none" for people without a relationship, otherwise a relationship type id */
  relationshipId: string;
  /** "" or one of LAST_CONTACT_FILTERS */
  lastContact: string;
  city: string;
  region: string;
  country: string;
}

export const EMPTY_MAP_FILTERS: MapFilterState = {
  query: '',
  groupId: '',
  relationshipId: '',
  lastContact: '',
  city: '',
  region: '',
  country: '',
};

export const NO_RELATIONSHIP_FILTER = 'none';

export function hasActiveMapFilters(filters: MapFilterState): boolean {
  return Object.values(filters).some((value) => value !== '');
}

/**
 * The person-level part of the filters (name, group, relationship, last
 * contact). Shared by the markers on the map and the list of people without a
 * place, which cannot be filtered by location.
 */
export function personMatchesFilters(
  person: Pick<MapPerson, 'personName' | 'groupIds' | 'relationshipTypeId' | 'lastContact'>,
  filters: MapFilterState,
  now: Date = new Date()
): boolean {
  const query = filters.query.trim();
  if (query && !matchesSearch(person.personName, query)) return false;
  if (filters.groupId && !person.groupIds.includes(filters.groupId)) return false;
  if (filters.relationshipId) {
    if (filters.relationshipId === NO_RELATIONSHIP_FILTER) {
      if (person.relationshipTypeId !== null) return false;
    } else if (person.relationshipTypeId !== filters.relationshipId) {
      return false;
    }
  }
  return matchesLastContactFilter(person.lastContact, filters.lastContact, now);
}

/**
 * Filters markers. When `peopleById` is given, group, relationship and last
 * contact come from the live person data (which changes when the user edits
 * a contact on the map) instead of the values frozen into the marker.
 */
export function filterMarkers(
  markers: MapMarker[],
  filters: MapFilterState,
  peopleById: ReadonlyMap<string, MapPerson> = new Map(),
  now: Date = new Date()
): MapMarker[] {
  const city = filters.city.trim().toLowerCase();
  const region = filters.region.trim().toLowerCase();

  return markers.filter((marker) => {
    const person = peopleById.get(marker.personId);
    const personView = {
      personName: marker.personName,
      groupIds: person?.groupIds ?? marker.groupIds,
      relationshipTypeId: person?.relationshipTypeId ?? null,
      lastContact: person?.lastContact ?? null,
    };
    if (!personMatchesFilters(personView, filters, now)) return false;
    if (city && (marker.city ?? '').toLowerCase() !== city) return false;
    if (region && (marker.region ?? '').toLowerCase() !== region) return false;
    if (filters.country && marker.country !== filters.country) return false;
    return true;
  });
}

/** Number of different people behind a list of markers (one person can have several). */
export function countDistinctPeople(markers: MapMarker[]): number {
  return new Set(markers.map((marker) => marker.personId)).size;
}

export function distinctCities(markers: MapMarker[]): string[] {
  const seen = new Map<string, string>();
  for (const marker of markers) {
    if (marker.city) {
      const key = marker.city.toLowerCase();
      if (!seen.has(key)) seen.set(key, marker.city);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function distinctRegions(markers: MapMarker[]): string[] {
  const seen = new Map<string, string>();
  for (const marker of markers) {
    if (marker.region) {
      const key = marker.region.toLowerCase();
      if (!seen.has(key)) seen.set(key, marker.region);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function distinctCountries(markers: MapMarker[]): string[] {
  const seen = new Set<string>();
  for (const marker of markers) {
    if (marker.country) seen.add(marker.country);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
