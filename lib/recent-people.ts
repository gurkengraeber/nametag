/**
 * The people a user opened most recently, newest first, kept in this browser
 * only. Only ids are stored; names are looked up in the search index so the
 * list never shows stale or deleted data.
 */
const STORAGE_KEY = 'nametag:recent-people';
export const MAX_RECENT_PEOPLE = 8;

/** Routes under /people that are not a person's profile. */
const RESERVED_SEGMENTS = new Set(['new', 'merge', 'duplicates']);

/**
 * Returns the person id when `pathname` is a profile or edit page, otherwise null.
 */
export function personIdFromPath(pathname: string): string | null {
  const match = /^\/people\/([^/]+)(?:\/edit)?\/?$/.exec(pathname);
  if (!match) return null;
  const segment = decodeURIComponent(match[1]);
  return RESERVED_SEGMENTS.has(segment) ? null : segment;
}

/** Moves `id` to the front, drops duplicates and caps the list. */
export function withRecentPerson(ids: string[], id: string, max = MAX_RECENT_PEOPLE): string[] {
  return [id, ...ids.filter((existing) => existing !== id)].slice(0, max);
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

export function readRecentPeople(): string[] {
  try {
    return parseIds(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function rememberRecentPerson(id: string): void {
  try {
    const next = withRecentPerson(readRecentPeople(), id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be blocked or full; the list is a convenience only.
  }
}

export function forgetRecentPeople(idsToDrop: string[]): void {
  if (idsToDrop.length === 0) return;
  try {
    const drop = new Set(idsToDrop);
    const next = readRecentPeople().filter((id) => !drop.has(id));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // See rememberRecentPerson.
  }
}
