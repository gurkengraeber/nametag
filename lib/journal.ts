import type { Prisma } from '@prisma/client';

/**
 * Pure helpers for the journal: title and preview text, relative dates,
 * list filters, and the unsaved-entry draft. Everything here is free of React
 * and of the database client, so it can be tested on its own and shared by the
 * journal page, the journal API, and the client components.
 */

export const PREVIEW_LENGTH = 150;
export const DERIVED_TITLE_LENGTH = 80;

const DATE_PARAM = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** Remove markdown syntax and collapse whitespace so the text reads as plain prose. */
export function stripMarkdown(body: string): string {
  return body
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/__([^_]+)__/g, '$1') // bold underscores
    .replace(/_([^_]+)_/g, '$1') // italic underscores
    .replace(/~~([^~]+)~~/g, '$1') // strikethrough
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline code and code blocks
    .replace(/^>\s+/gm, '') // blockquotes
    .replace(/^[-*+]\s+/gm, '') // list items
    .replace(/^\d+\.\s+/gm, '') // ordered list items
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Title for an entry written without one: the first line of the body, stripped
 * of markdown and shortened at a word boundary. Empty when the body has no text.
 */
export function deriveEntryTitle(body: string, maxLength: number = DERIVED_TITLE_LENGTH): string {
  const firstLine = body.split('\n').map((line) => stripMarkdown(line)).find((line) => line.length > 0);
  if (!firstLine) return '';
  if (firstLine.length <= maxLength) return firstLine;

  const cut = firstLine.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > maxLength * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface TextPart {
  text: string;
  match: boolean;
}

/** Split text into plain and matching parts for a case-insensitive search term. */
export function splitHighlight(text: string, query: string | undefined): TextPart[] {
  const term = query?.trim();
  if (!term) return [{ text, match: false }];

  const parts: TextPart[] = [];
  const re = new RegExp(escapeRegExp(term), 'gi');
  let last = 0;
  for (const m of text.matchAll(re)) {
    const index = m.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), match: false });
    parts.push({ text: m[0], match: true });
    last = index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}

export interface EntryPreview {
  text: string;
  /** True when the entry has more to show than the preview does. */
  isLong: boolean;
}

/**
 * Preview text for the timeline. Skips the part of the body the title already
 * repeats (a title derived from the first line), and when a search term is
 * given it centres the preview on the first match so the hit is visible.
 */
export function buildEntryPreview(
  title: string,
  body: string,
  query?: string,
  maxLength: number = PREVIEW_LENGTH,
): EntryPreview {
  let text = stripMarkdown(body);
  const lineCount = body.split('\n').filter((line) => line.trim().length > 0).length;

  const titleBase = title.replace(/…$/, '').trim();
  if (titleBase && text.toLowerCase().startsWith(titleBase.toLowerCase())) {
    text = text.slice(titleBase.length).replace(/^[\s…]+/, '');
  }

  const isLong = text.length > maxLength || lineCount > 3;
  const term = query?.trim();

  if (term && text.length > maxLength) {
    const at = text.toLowerCase().indexOf(term.toLowerCase());
    if (at > maxLength - term.length) {
      const start = Math.max(0, at - Math.floor(maxLength / 3));
      const slice = text.slice(start, start + maxLength).trim();
      return { text: `…${slice}${start + maxLength < text.length ? '…' : ''}`, isLong };
    }
  }

  if (text.length <= maxLength) return { text, isLong };
  return { text: `${text.slice(0, maxLength).trimEnd()}…`, isLong };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar day as YYYY-MM-DD. */
export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A YYYY-MM-DD string for a real calendar day, or null. */
export function parseDateParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = DATE_PARAM.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return value;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Relative label for a day ("yesterday", "3 days ago", "last month", ...) in
 * the given locale. Day differences are counted in local calendar days.
 */
export function getRelativeDayLabel(entryDate: Date, now: Date, locale: string): string {
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }

  const a = startOfLocalDay(entryDate);
  const b = startOfLocalDay(now);
  const days = Math.round((a.getTime() - b.getTime()) / 86_400_000);

  if (Math.abs(days) < 7) return rtf.format(days, 'day');
  if (Math.abs(days) < 35) return rtf.format(Math.round(days / 7), 'week');

  // Whole calendar months between the two days, counted towards zero.
  let months = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
  if (months > 0 && a.getDate() < b.getDate()) months -= 1;
  if (months < 0 && a.getDate() > b.getDate()) months += 1;
  if (months === 0) return rtf.format(Math.round(days / 7), 'week');
  if (Math.abs(months) < 12) return rtf.format(months, 'month');
  return rtf.format(Math.trunc(months / 12), 'year');
}

/**
 * Whether the "update last contact" box starts checked: an entry about
 * something that has already happened counts as contact, one dated in the
 * future (a plan) does not.
 */
export function defaultUpdateLastContact(entryDate: string, today: string): boolean {
  return entryDate <= today;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type RangePresetId = 'week' | 'month' | 'year';

export interface DateRange {
  from: string;
  to: string;
}

function shiftDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Quick time-range choices for the timeline, computed from the viewer's today. */
export function getRangePresets(today: Date): Array<DateRange & { id: RangePresetId }> {
  const to = toLocalDateString(today);
  return [
    { id: 'week', from: toLocalDateString(shiftDays(today, -6)), to },
    { id: 'month', from: toLocalDateString(shiftDays(today, -29)), to },
    {
      id: 'year',
      from: `${today.getFullYear()}-01-01`,
      to: `${today.getFullYear()}-12-31`,
    },
  ];
}

/** Split a comma separated `person` query value into unique, non-empty ids. */
export function parsePersonIds(param: string | null | undefined): string[] {
  if (!param) return [];
  return Array.from(new Set(param.split(',').map((id) => id.trim()).filter(Boolean)));
}

export interface JournalListFilters {
  userId: string;
  personIds?: string[];
  search?: string | null;
  from?: string | null;
  to?: string | null;
  /** IANA zone of the viewer, used to compare entries that have a time of day. */
  timeZone?: string | null;
}

function toDayAfter(day: string): string {
  return nextUtcDay(day).toISOString().slice(0, 10);
}

function nextUtcDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1));
}

/** Milliseconds the zone is ahead of UTC at the given instant, or null for an unknown zone. */
function zoneOffsetMs(instant: number, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(instant / 1000) * 1000;
  } catch {
    return null;
  }
}

/** The instant a calendar day (YYYY-MM-DD) starts in the given IANA zone, or null for an unknown zone. */
export function startOfDayInZone(day: string, timeZone: string): Date | null {
  const [y, m, d] = day.split('-').map(Number);
  const wallClock = Date.UTC(y, m - 1, d);
  const first = zoneOffsetMs(wallClock, timeZone);
  if (first === null) return null;
  // The offset can differ at the resulting instant (daylight saving), so settle it once more.
  const second = zoneOffsetMs(wallClock - first, timeZone) ?? first;
  return new Date(wallClock - second);
}

/**
 * Where clause shared by the journal page and GET /api/journal. Several people
 * narrow the list (an entry must tag all of them). `from` and `to` are
 * inclusive calendar days; invalid values are ignored. Entries without a time
 * are stored as the UTC midnight of their day and compared as UTC days. Entries
 * with a time are real instants, so with a valid IANA `timeZone` they are
 * compared as days of that zone (the viewer's); without one, as UTC days too.
 */
export function buildJournalWhere(filters: JournalListFilters): Prisma.JournalEntryWhereInput {
  const personIds = filters.personIds ?? [];
  const search = filters.search?.trim();
  const from = parseDateParam(filters.from);
  const to = parseDateParam(filters.to);

  const utcRange = {
    ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }),
    ...(to && { lt: nextUtcDay(to) }),
  };
  const zoneFrom = from && filters.timeZone ? startOfDayInZone(from, filters.timeZone) : null;
  const zoneEnd = to && filters.timeZone ? startOfDayInZone(toDayAfter(to), filters.timeZone) : null;
  const zoned = Boolean(filters.timeZone) && (!from || zoneFrom) && (!to || zoneEnd);
  const timedRange = {
    ...(zoneFrom && { gte: zoneFrom }),
    ...(zoneEnd && { lt: zoneEnd }),
  };

  return {
    userId: filters.userId,
    deletedAt: null,
    ...((personIds.length > 0 || (zoned && (from || to))) && {
      AND: [
        ...personIds.map((personId) => ({
          people: { some: { personId, person: { deletedAt: null } } },
        })),
        ...(zoned && (from || to)
          ? [{ OR: [{ hasTime: false, date: utcRange }, { hasTime: true, date: timedRange }] }]
          : []),
      ],
    }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { body: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(!zoned && (from || to) && { date: utcRange }),
  };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/**
 * People tagged most recently, newest entry first, without repeats. The input
 * is expected newest first, as the entry list is.
 */
export function recentPersonIds(
  entries: Array<{ people: Array<{ personId: string }> }>,
  limit: number,
): string[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const { personId } of entry.people) {
      if (seen.size >= limit) return Array.from(seen);
      seen.add(personId);
    }
  }
  return Array.from(seen);
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

export interface JournalDraft {
  title: string;
  body: string;
  /** Only set when the user changed it; null means "keep the default". */
  date: string | null;
  time: string | null;
  hasTime: boolean;
  personIds: string[];
}

/** Under the shared `nametag:` prefix, so signing out wipes drafts with clearNametagStorage(). */
export const JOURNAL_DRAFT_PREFIX = 'nametag:journal-draft:';

/** Drafts older than this are dropped when they are next looked at. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Drafts are keyed by account, so another account on the same browser never sees them. */
export function newEntryDraftKey(userId: string): string {
  return `${JOURNAL_DRAFT_PREFIX}${userId}:new`;
}

export function editEntryDraftKey(userId: string, entryId: string): string {
  return `${JOURNAL_DRAFT_PREFIX}${userId}:edit:${entryId}`;
}

/** A draft with no text carries nothing worth restoring. */
export function isDraftEmpty(draft: JournalDraft): boolean {
  return draft.title.trim() === '' && draft.body.trim() === '';
}

/**
 * Read a stored draft. Returns null for anything that is not a usable draft of
 * this account: bad JSON, no owner or timestamp, another account, or too old.
 */
export function parseDraft(
  raw: string | null,
  userId: string,
  now: number = Date.now(),
): JournalDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    if (typeof v.userId !== 'string' || v.userId !== userId) return null;
    if (typeof v.savedAt !== 'number' || now - v.savedAt > DRAFT_MAX_AGE_MS) return null;
    if (typeof v.title !== 'string' || typeof v.body !== 'string') return null;

    const date = typeof v.date === 'string' ? parseDateParam(v.date) : null;
    const time = typeof v.time === 'string' && /^\d{2}:\d{2}$/.test(v.time) ? v.time : null;
    const personIds = Array.isArray(v.personIds)
      ? v.personIds.filter((id): id is string => typeof id === 'string')
      : [];

    const draft: JournalDraft = {
      title: v.title,
      body: v.body,
      date,
      time,
      hasTime: v.hasTime === true && time !== null,
      personIds,
    };
    return isDraftEmpty(draft) ? null : draft;
  } catch {
    return null;
  }
}

/** Read a draft; storage can be missing or blocked, in which case there is none. */
export function readDraft(key: string, userId: string, now: number = Date.now()): JournalDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    const draft = parseDraft(raw, userId, now);
    // An unusable entry (expired, foreign, damaged) is not worth keeping around.
    if (raw && !draft) window.localStorage.removeItem(key);
    return draft;
  } catch {
    return null;
  }
}

/** Store a draft, or drop it when it is empty. Returns whether storage worked. */
export function writeDraft(
  key: string,
  userId: string,
  draft: JournalDraft,
  now: number = Date.now(),
): boolean {
  try {
    if (isDraftEmpty(draft)) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify({ ...draft, userId, savedAt: now }));
    }
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

function journalDraftKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(JOURNAL_DRAFT_PREFIX)) keys.push(key);
  }
  return keys;
}

/** Remove drafts that have expired or cannot be read, whoever they belong to. */
export function purgeStaleJournalDrafts(now: number = Date.now()): void {
  try {
    for (const key of journalDraftKeys()) {
      let stale = true;
      try {
        const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? '');
        if (typeof value === 'object' && value !== null && 'savedAt' in value) {
          stale = typeof value.savedAt !== 'number' || now - value.savedAt > DRAFT_MAX_AGE_MS;
        }
      } catch {
        stale = true;
      }
      if (stale) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable: nothing to purge.
  }
}
