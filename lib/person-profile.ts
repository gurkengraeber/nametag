import { isPredefinedType } from '@/lib/important-date-types';
import { parseCalendarDate, YEAR_UNKNOWN_SENTINEL } from '@/lib/date-format';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type RelativeTimeKey =
  | 'today'
  | 'oneDayAgo'
  | 'daysAgo'
  | 'oneMonthAgo'
  | 'monthsAgo'
  | 'oneYearAgo'
  | 'yearsAgo';

export interface RelativeTime {
  key: RelativeTimeKey;
  values?: { days: number } | { months: number } | { years: number };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Describes how long ago a local calendar day was ("today", "3 days ago",
 * "2 months ago", ...) as a translation key plus values. The caller formats it
 * with its own translation function, so the same wording works on the server
 * and in client components. Future dates count as "today".
 */
export function getRelativeTime(date: Date, now: Date = new Date()): RelativeTime {
  const day = startOfDay(date);
  const today = startOfDay(now);
  const diffDays = Math.max(0, Math.round((today.getTime() - day.getTime()) / MS_PER_DAY));

  if (diffDays === 0) return { key: 'today' };
  if (diffDays === 1) return { key: 'oneDayAgo' };
  if (diffDays < 28) return { key: 'daysAgo', values: { days: diffDays } };

  let months = (today.getFullYear() - day.getFullYear()) * 12 + today.getMonth() - day.getMonth();
  if (today.getDate() < day.getDate()) months--;

  if (months < 12) {
    if (months <= 0) return { key: 'daysAgo', values: { days: diffDays } };
    return months === 1 ? { key: 'oneMonthAgo' } : { key: 'monthsAgo', values: { months } };
  }
  const years = Math.floor(months / 12);
  return years === 1 ? { key: 'oneYearAgo' } : { key: 'yearsAgo', values: { years } };
}

export interface NextDateInput {
  id: string;
  type?: string | null;
  title: string;
  date: Date | string;
  reminderType?: string | null;
}

export interface NextDate<T extends NextDateInput = NextDateInput> {
  item: T;
  /** Next occurrence as a local calendar day. */
  date: Date;
  daysUntil: number;
  isYearUnknown: boolean;
}

/**
 * Finds the soonest upcoming important date of a person. Birthdays,
 * anniversaries, name days, memorials, dates without a known year and dates
 * with a recurring reminder repeat every year. Other custom dates only count
 * while they lie in the future. Today counts as upcoming (daysUntil 0).
 */
export function getNextImportantDate<T extends NextDateInput>(
  dates: readonly T[],
  now: Date = new Date()
): NextDate<T> | null {
  const today = startOfDay(now);
  let best: NextDate<T> | null = null;

  for (const item of dates) {
    const stored = parseCalendarDate(item.date);
    const isYearUnknown = stored.getFullYear() <= YEAR_UNKNOWN_SENTINEL;
    const repeatsYearly =
      isYearUnknown ||
      (!!item.type && isPredefinedType(item.type)) ||
      item.reminderType === 'RECURRING';

    let next: Date;
    if (repeatsYearly) {
      next = new Date(today.getFullYear(), stored.getMonth(), stored.getDate());
      if (next.getTime() < today.getTime()) {
        next = new Date(today.getFullYear() + 1, stored.getMonth(), stored.getDate());
      }
    } else {
      next = startOfDay(stored);
      if (next.getTime() < today.getTime()) continue;
    }

    const daysUntil = Math.round((next.getTime() - today.getTime()) / MS_PER_DAY);
    if (!best || daysUntil < best.daysUntil) {
      best = { item, date: next, daysUntil, isYearUnknown };
    }
  }

  return best;
}

export const MAX_NOTES_LENGTH = 10000;

/**
 * Appends a new note to existing markdown notes, separated by a blank line.
 * Returns null when the addition is empty or the result would exceed the
 * notes limit of the API.
 */
export function appendNote(existing: string | null | undefined, addition: string): string | null {
  const text = addition.trim();
  if (!text) return null;
  const base = (existing ?? '').trimEnd();
  const combined = base ? `${base}\n\n${text}` : text;
  return combined.length > MAX_NOTES_LENGTH ? null : combined;
}

/** Group IDs that were added and removed when going from `previous` to `next`. */
export function diffIds(
  previous: readonly string[],
  next: readonly string[]
): { added: string[]; removed: string[] } {
  const prev = new Set(previous);
  const nxt = new Set(next);
  return {
    added: next.filter((id) => !prev.has(id)),
    removed: previous.filter((id) => !nxt.has(id)),
  };
}

const IM_URL_BUILDERS: Record<string, (handle: string) => string> = {
  telegram: (h) => `https://t.me/${h.replace(/^@/, '')}`,
  skype: (h) => `skype:${h}?chat`,
};

/**
 * Link for an instant messaging handle, or null when the protocol has no
 * reliable deep link (e.g. WhatsApp handles are phone numbers, not names).
 */
export function getImHandleHref(protocol: string, handle: string): string | null {
  const trimmed = handle.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const build = IM_URL_BUILDERS[protocol.trim().toLowerCase()];
  return build ? build(encodeURI(trimmed)) : null;
}

export interface GroupableRelationship {
  relationshipType: { id: string; label: string; color: string | null } | null;
  person: { name: string; surname?: string | null };
}

export interface RelationshipGroup<T extends GroupableRelationship> {
  key: string;
  label: string | null;
  color: string | null;
  items: T[];
}

/**
 * Groups a person's connections by relationship type, groups sorted by type
 * label (connections without a type last) and members sorted by name.
 */
export function groupRelationshipsByType<T extends GroupableRelationship>(
  relationships: readonly T[]
): RelationshipGroup<T>[] {
  const groups = new Map<string, RelationshipGroup<T>>();
  for (const rel of relationships) {
    const type = rel.relationshipType;
    const key = type?.id ?? '__none__';
    let group = groups.get(key);
    if (!group) {
      group = { key, label: type?.label ?? null, color: type?.color ?? null, items: [] };
      groups.set(key, group);
    }
    group.items.push(rel);
  }

  const fullName = (rel: T) => `${rel.person.name} ${rel.person.surname ?? ''}`.trim();
  const result = Array.from(groups.values());
  for (const group of result) {
    group.items.sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }
  result.sort((a, b) => {
    if (a.label === null) return b.label === null ? 0 : 1;
    if (b.label === null) return -1;
    return a.label.localeCompare(b.label);
  });
  return result;
}
