import { EMPTY_MAP_FILTERS, type MapFilterState } from './filter-markers';
import { isLastContactFilter } from './last-contact';

// Keys are namespaced with the account id (and the stored value repeats it,
// checked on read), so a different account on the same browser never picks up
// someone else's view. Only the camera and filter values are stored: never
// names, search text or the coordinates of individual people.
export function viewKey(userId: string): string {
  return `nametag:map:${userId}:view`;
}

export function filtersKey(userId: string): string {
  return `nametag:map:${userId}:filters`;
}

/** The camera of the map: center and zoom level. */
export interface StoredMapView {
  longitude: number;
  latitude: number;
  zoom: number;
}

export function parseStoredView(raw: string | null, userId: string): StoredMapView | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { longitude, latitude, zoom, userId: storedUserId } = value as Record<string, unknown>;
    if (storedUserId !== userId) return null;
    if (typeof longitude !== 'number' || typeof latitude !== 'number' || typeof zoom !== 'number') return null;
    if (![longitude, latitude, zoom].every(Number.isFinite)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    if (zoom < 0 || zoom > 24) return null;
    return { longitude, latitude, zoom };
  } catch {
    return null;
  }
}

/** The search text is typed by the user and may be a person's name, so it is never remembered. */
const STORED_FILTER_KEYS = (Object.keys(EMPTY_MAP_FILTERS) as Array<keyof MapFilterState>).filter(
  (key) => key !== 'query'
);

export function parseStoredFilters(raw: string | null, userId: string): MapFilterState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    if (record.userId !== userId) return null;
    const filters: MapFilterState = { ...EMPTY_MAP_FILTERS };
    for (const key of STORED_FILTER_KEYS) {
      const entry = record[key];
      if (typeof entry === 'string') filters[key] = entry;
    }
    if (!isLastContactFilter(filters.lastContact)) filters.lastContact = '';
    return filters;
  } catch {
    return null;
  }
}

// Storage can be missing or throw (private windows, blocked site data), and
// the map must work the same without it.
function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: remembering the view is a convenience only.
  }
}

export function readStoredView(userId: string): StoredMapView | null {
  return parseStoredView(readItem(viewKey(userId)), userId);
}

export function writeStoredView(userId: string, view: StoredMapView): void {
  writeItem(
    viewKey(userId),
    JSON.stringify({ userId, longitude: view.longitude, latitude: view.latitude, zoom: view.zoom })
  );
}

export function readStoredFilters(userId: string): MapFilterState | null {
  return parseStoredFilters(readItem(filtersKey(userId)), userId);
}

export function writeStoredFilters(userId: string, filters: MapFilterState): void {
  const stored: Record<string, string> = { userId };
  for (const key of STORED_FILTER_KEYS) stored[key] = filters[key];
  writeItem(filtersKey(userId), JSON.stringify(stored));
}
