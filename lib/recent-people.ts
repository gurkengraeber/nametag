import { STORAGE_MAX_AGE_MS, storageKey } from '@/lib/client-storage';

/**
 * The people a user opened most recently, newest first, kept in this browser
 * only. Only ids and a timestamp are stored; names are looked up in the search
 * index so the list never shows stale or deleted data. The list belongs to one
 * account (the key and the stored value both carry the user id) and entries
 * expire after 30 days.
 */
const AREA = 'recent-people';
export const MAX_RECENT_PEOPLE = 8;

interface RecentEntry {
  id: string;
  at: number;
}

interface StoredRecent {
  userId: string;
  entries: RecentEntry[];
}

/** Routes under /people that are not a person's profile. */
const RESERVED_SEGMENTS = new Set(['new', 'merge', 'duplicates']);

/**
 * Returns the person id when `pathname` is a profile or edit page, otherwise null.
 */
export function personIdFromPath(pathname: string): string | null {
  const match = /^\/people\/([^/]+)(?:\/edit)?\/?$/.exec(pathname);
  if (!match) return null;
  let segment: string;
  try {
    segment = decodeURIComponent(match[1]);
  } catch {
    // A hand-typed address with a broken % escape is not a profile.
    return null;
  }
  return RESERVED_SEGMENTS.has(segment) ? null : segment;
}

/** Moves `id` to the front, drops duplicates and caps the list. */
export function withRecentPerson(
  entries: RecentEntry[],
  id: string,
  now: number,
  max = MAX_RECENT_PEOPLE
): RecentEntry[] {
  return [{ id, at: now }, ...entries.filter((entry) => entry.id !== id)].slice(0, max);
}

/** Keeps only well-formed entries that are not older than the retention limit. */
export function freshEntries(entries: RecentEntry[], now: number): RecentEntry[] {
  return entries.filter((entry) => now - entry.at <= STORAGE_MAX_AGE_MS && entry.at <= now + 60_000);
}

function parseStored(raw: string | null, userId: string): RecentEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return [];
    const { userId: owner, entries } = parsed as Partial<StoredRecent>;
    // A value written for another account is never shown, even under this key.
    if (owner !== userId || !Array.isArray(entries)) return [];
    return entries.filter(
      (entry): entry is RecentEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentEntry).id === 'string' &&
        typeof (entry as RecentEntry).at === 'number'
    );
  } catch {
    return [];
  }
}

function load(userId: string, now: number): RecentEntry[] {
  try {
    return freshEntries(parseStored(window.localStorage.getItem(storageKey(AREA, userId)), userId), now);
  } catch {
    return [];
  }
}

function save(userId: string, entries: RecentEntry[]): void {
  try {
    const value: StoredRecent = { userId, entries };
    window.localStorage.setItem(storageKey(AREA, userId), JSON.stringify(value));
  } catch {
    // Storage can be blocked or full; the list is a convenience only.
  }
}

export function readRecentPeople(userId: string | undefined, now = Date.now()): string[] {
  if (!userId) return [];
  return load(userId, now).map((entry) => entry.id);
}

export function rememberRecentPerson(userId: string | undefined, id: string, now = Date.now()): void {
  if (!userId) return;
  save(userId, withRecentPerson(load(userId, now), id, now));
}

export function forgetRecentPeople(userId: string | undefined, idsToDrop: string[]): void {
  if (!userId || idsToDrop.length === 0) return;
  const drop = new Set(idsToDrop);
  save(userId, load(userId, Date.now()).filter((entry) => !drop.has(entry.id)));
}
