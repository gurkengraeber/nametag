import { getLocalDateString } from '@/lib/date-format';

/**
 * "Last contacted" filter values of the map. The "over" values mean "not
 * talked to for longer than N months", and they include people with no
 * recorded contact, because those have not been talked to in that time either.
 */
export const LAST_CONTACT_FILTERS = ['over1m', 'over3m', 'over6m', 'over12m', 'never'] as const;

export type LastContactFilter = (typeof LAST_CONTACT_FILTERS)[number];

const MONTHS_BY_FILTER: Record<Exclude<LastContactFilter, 'never'>, number> = {
  over1m: 1,
  over3m: 3,
  over6m: 6,
  over12m: 12,
};

export function isLastContactFilter(value: string): value is LastContactFilter {
  return (LAST_CONTACT_FILTERS as readonly string[]).includes(value);
}

/** Calendar date "YYYY-MM-DD" that lies the given number of months before `now`, in local time. */
export function monthsAgoDateString(months: number, now: Date): string {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  cutoff.setMonth(cutoff.getMonth() - months);
  // Clamp the day to the length of the target month (31 March minus 1 month is 28/29 February).
  const lastDayOfTarget = new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate();
  cutoff.setDate(Math.min(now.getDate(), lastDayOfTarget));
  return getLocalDateString(cutoff);
}

/** True when a person with this last contact date passes the filter. An empty filter passes everyone. */
export function matchesLastContactFilter(
  lastContact: string | null,
  filter: string,
  now: Date = new Date()
): boolean {
  if (!filter) return true;
  if (!isLastContactFilter(filter)) return true;
  if (filter === 'never') return lastContact === null;
  if (lastContact === null) return true;
  // Dates are zero-padded ISO calendar dates, so string comparison is date comparison.
  return lastContact <= monthsAgoDateString(MONTHS_BY_FILTER[filter], now);
}

export type LastContactAge =
  | { kind: 'never' }
  | { kind: 'today' }
  | { kind: 'days'; count: number }
  | { kind: 'months'; count: number }
  | { kind: 'years'; count: number };

function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Coarse age of a last contact date, like the person page ("3 months ago"). */
export function describeLastContact(lastContact: string | null, now: Date = new Date()): LastContactAge {
  if (!lastContact) return { kind: 'never' };
  const date = parseCalendarDate(lastContact);
  if (!date) return { kind: 'never' };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return { kind: 'today' };
  if (days < 28) return { kind: 'days', count: days };
  let months = (today.getFullYear() - date.getFullYear()) * 12 + today.getMonth() - date.getMonth();
  if (today.getDate() < date.getDate()) months--;
  if (months < 1) return { kind: 'days', count: days };
  if (months < 12) return { kind: 'months', count: months };
  return { kind: 'years', count: Math.floor(months / 12) };
}
