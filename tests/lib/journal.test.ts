import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearNametagStorage } from '../../lib/client-storage';
import {
  stripMarkdown,
  deriveEntryTitle,
  splitHighlight,
  buildEntryPreview,
  parseDateParam,
  getRelativeDayLabel,
  defaultUpdateLastContact,
  getRangePresets,
  parsePersonIds,
  buildJournalWhere,
  startOfDayInZone,
  recentPersonIds,
  parseDraft,
  readDraft,
  writeDraft,
  clearDraft,
  isDraftEmpty,
  editEntryDraftKey,
  newEntryDraftKey,
  purgeStaleJournalDrafts,
  DRAFT_MAX_AGE_MS,
  JOURNAL_DRAFT_PREFIX,
  type JournalDraft,
} from '../../lib/journal';

describe('stripMarkdown', () => {
  it('removes common markdown and collapses whitespace', () => {
    expect(stripMarkdown('# Title\n\n**bold** and _italic_ with [a link](http://x.test)\n- item')).toBe(
      'Title bold and italic with a link item',
    );
  });
});

describe('deriveEntryTitle', () => {
  it('uses the first non-empty line without markdown', () => {
    expect(deriveEntryTitle('\n\n## Coffee with Sara\nWe talked a lot.')).toBe('Coffee with Sara');
  });

  it('shortens long lines at a word boundary', () => {
    const title = deriveEntryTitle('word '.repeat(40), 30);
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(31);
    expect(title).not.toMatch(/\s…$/);
  });

  it('returns an empty string when there is no text', () => {
    expect(deriveEntryTitle('   \n ')).toBe('');
    expect(deriveEntryTitle('![img](x.png)')).toBe('');
  });
});

describe('splitHighlight', () => {
  it('marks case-insensitive matches', () => {
    expect(splitHighlight('Coffee and COFFEE', 'coffee')).toEqual([
      { text: 'Coffee', match: true },
      { text: ' and ', match: false },
      { text: 'COFFEE', match: true },
    ]);
  });

  it('treats the query literally', () => {
    expect(splitHighlight('a (b) c', '(b)')).toEqual([
      { text: 'a ', match: false },
      { text: '(b)', match: true },
      { text: ' c', match: false },
    ]);
  });

  it('returns the whole text for an empty query', () => {
    expect(splitHighlight('hello', '  ')).toEqual([{ text: 'hello', match: false }]);
    expect(splitHighlight('hello', undefined)).toEqual([{ text: 'hello', match: false }]);
  });
});

describe('buildEntryPreview', () => {
  it('returns a short body unchanged and not long', () => {
    expect(buildEntryPreview('Title', 'Short note.')).toEqual({ text: 'Short note.', isLong: false });
  });

  it('truncates long bodies and flags them as long', () => {
    const preview = buildEntryPreview('Title', 'x'.repeat(300));
    expect(preview.isLong).toBe(true);
    expect(preview.text.length).toBe(151);
    expect(preview.text.endsWith('…')).toBe(true);
  });

  it('flags bodies with many lines as long even when short', () => {
    expect(buildEntryPreview('T', 'a\nb\nc\nd').isLong).toBe(true);
  });

  it('skips the part of the body that a derived title repeats', () => {
    const body = 'Dinner at the lake\nIt was warm and we stayed late.';
    const preview = buildEntryPreview('Dinner at the lake', body);
    expect(preview.text).toBe('It was warm and we stayed late.');
  });

  it('centres the preview on a search match that is far into the text', () => {
    const body = `${'filler '.repeat(60)}needle ${'more '.repeat(60)}`;
    const preview = buildEntryPreview('T', body, 'needle');
    expect(preview.text).toContain('needle');
    expect(preview.text.startsWith('…')).toBe(true);
  });
});

describe('parseDateParam', () => {
  it('accepts real calendar days only', () => {
    expect(parseDateParam('2026-02-28')).toBe('2026-02-28');
    expect(parseDateParam('2026-02-30')).toBeNull();
    expect(parseDateParam('2026-2-3')).toBeNull();
    expect(parseDateParam('')).toBeNull();
    expect(parseDateParam(null)).toBeNull();
  });
});

describe('getRelativeDayLabel', () => {
  const now = new Date(2026, 10, 9, 15, 0);
  const label = (y: number, m: number, d: number) => getRelativeDayLabel(new Date(y, m - 1, d), now, 'en');

  it('names the nearest days', () => {
    expect(label(2026, 11, 9)).toBe('today');
    expect(label(2026, 11, 8)).toBe('yesterday');
    expect(label(2026, 11, 10)).toBe('tomorrow');
    expect(label(2026, 11, 6)).toBe('3 days ago');
  });

  it('uses weeks, months and years further out', () => {
    expect(label(2026, 10, 26)).toBe('2 weeks ago');
    expect(label(2026, 9, 9)).toBe('2 months ago');
    expect(label(2026, 1, 5)).toBe('10 months ago');
    expect(label(2025, 11, 9)).toBe('last year');
    expect(label(2023, 11, 9)).toBe('3 years ago');
  });

  it('counts calendar days, not 24 hour spans', () => {
    const lateNow = new Date(2026, 10, 9, 0, 5);
    expect(getRelativeDayLabel(new Date(2026, 10, 8, 23, 50), lateNow, 'en')).toBe('yesterday');
  });

  it('follows the locale and survives an invalid one', () => {
    expect(getRelativeDayLabel(new Date(2026, 10, 8), now, 'de-DE')).toBe('gestern');
    expect(getRelativeDayLabel(new Date(2026, 10, 8), now, 'not a locale!')).toBe('yesterday');
  });
});

describe('defaultUpdateLastContact', () => {
  it('is on for today and the past, off for the future', () => {
    expect(defaultUpdateLastContact('2026-11-09', '2026-11-09')).toBe(true);
    expect(defaultUpdateLastContact('2026-10-01', '2026-11-09')).toBe(true);
    expect(defaultUpdateLastContact('2026-11-10', '2026-11-09')).toBe(false);
  });
});

describe('getRangePresets', () => {
  it('builds inclusive ranges from the viewer today', () => {
    const presets = getRangePresets(new Date(2026, 10, 9));
    expect(presets).toEqual([
      { id: 'week', from: '2026-11-03', to: '2026-11-09' },
      { id: 'month', from: '2026-10-11', to: '2026-11-09' },
      { id: 'year', from: '2026-01-01', to: '2026-12-31' },
    ]);
  });
});

describe('parsePersonIds', () => {
  it('splits, trims and removes duplicates and blanks', () => {
    expect(parsePersonIds('a, b,,a')).toEqual(['a', 'b']);
    expect(parsePersonIds(null)).toEqual([]);
    expect(parsePersonIds('')).toEqual([]);
  });
});

describe('buildJournalWhere', () => {
  it('always scopes to the user and hides deleted entries', () => {
    expect(buildJournalWhere({ userId: 'u1' })).toEqual({ userId: 'u1', deletedAt: null });
  });

  it('requires every selected person', () => {
    const where = buildJournalWhere({ userId: 'u1', personIds: ['p1', 'p2'] });
    expect(where.AND).toEqual([
      { people: { some: { personId: 'p1', person: { deletedAt: null } } } },
      { people: { some: { personId: 'p2', person: { deletedAt: null } } } },
    ]);
  });

  it('searches title and body, ignoring blank queries', () => {
    expect(buildJournalWhere({ userId: 'u1', search: '   ' }).OR).toBeUndefined();
    expect(buildJournalWhere({ userId: 'u1', search: ' lake ' }).OR).toEqual([
      { title: { contains: 'lake', mode: 'insensitive' } },
      { body: { contains: 'lake', mode: 'insensitive' } },
    ]);
  });

  it('turns from and to into an inclusive UTC day range', () => {
    const where = buildJournalWhere({ userId: 'u1', from: '2026-03-01', to: '2026-03-31' });
    expect(where.date).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
      lt: new Date('2026-04-01T00:00:00.000Z'),
    });
  });

  it('supports an open-ended range and ignores invalid dates', () => {
    expect(buildJournalWhere({ userId: 'u1', from: '2026-03-01' }).date).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(buildJournalWhere({ userId: 'u1', from: 'nope', to: '2026-13-01' }).date).toBeUndefined();
  });
});

describe('startOfDayInZone', () => {
  it('finds local midnight across offsets and daylight saving', () => {
    expect(startOfDayInZone('2026-03-01', 'Europe/Berlin')).toEqual(new Date('2026-02-28T23:00:00.000Z'));
    expect(startOfDayInZone('2026-07-01', 'Europe/Berlin')).toEqual(new Date('2026-06-30T22:00:00.000Z'));
    expect(startOfDayInZone('2026-03-30', 'Europe/Berlin')).toEqual(new Date('2026-03-29T22:00:00.000Z'));
    expect(startOfDayInZone('2026-03-01', 'America/New_York')).toEqual(new Date('2026-03-01T05:00:00.000Z'));
    expect(startOfDayInZone('2026-03-01', 'UTC')).toEqual(new Date('2026-03-01T00:00:00.000Z'));
  });

  it('returns null for an unknown zone', () => {
    expect(startOfDayInZone('2026-03-01', 'Nowhere/Land')).toBeNull();
  });
});

describe('buildJournalWhere with a time zone', () => {
  it('compares entries with a time as local days and entries without as UTC days', () => {
    const where = buildJournalWhere({
      userId: 'u1',
      from: '2026-03-01',
      to: '2026-03-31',
      timeZone: 'Europe/Berlin',
    });
    expect(where.date).toBeUndefined();
    expect(where.AND).toEqual([
      {
        OR: [
          {
            hasTime: false,
            date: {
              gte: new Date('2026-03-01T00:00:00.000Z'),
              lt: new Date('2026-04-01T00:00:00.000Z'),
            },
          },
          {
            hasTime: true,
            date: {
              gte: new Date('2026-02-28T23:00:00.000Z'),
              lt: new Date('2026-03-31T22:00:00.000Z'),
            },
          },
        ],
      },
    ]);
  });

  it('keeps the person filters next to the day range', () => {
    const where = buildJournalWhere({
      userId: 'u1',
      personIds: ['p1'],
      from: '2026-03-01',
      timeZone: 'Asia/Tokyo',
    });
    expect(where.AND).toHaveLength(2);
  });

  it('falls back to UTC days for an unknown zone and ignores a zone without a range', () => {
    const utc = buildJournalWhere({ userId: 'u1', from: '2026-03-01', to: '2026-03-31' });
    expect(buildJournalWhere({ userId: 'u1', from: '2026-03-01', to: '2026-03-31', timeZone: 'Nowhere/Land' })).toEqual(utc);
    expect(buildJournalWhere({ userId: 'u1', timeZone: 'Europe/Berlin' })).toEqual({ userId: 'u1', deletedAt: null });
  });
});

describe('recentPersonIds', () => {
  it('lists people by most recent entry without repeats, up to the limit', () => {
    const entries = [
      { people: [{ personId: 'a' }, { personId: 'b' }] },
      { people: [{ personId: 'a' }, { personId: 'c' }] },
      { people: [{ personId: 'd' }] },
    ];
    expect(recentPersonIds(entries, 3)).toEqual(['a', 'b', 'c']);
    expect(recentPersonIds(entries, 10)).toEqual(['a', 'b', 'c', 'd']);
    expect(recentPersonIds([], 3)).toEqual([]);
  });
});

const USER = 'user-1';
const NOW = 1_800_000_000_000;

describe('draft parsing', () => {
  const draft: JournalDraft = {
    title: '',
    body: 'Half written',
    date: '2026-11-01',
    time: '09:30',
    hasTime: true,
    personIds: ['p1'],
  };
  const stored = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({ ...draft, userId: USER, savedAt: NOW, ...extra });

  it('round trips a draft', () => {
    expect(parseDraft(stored(), USER, NOW)).toEqual(draft);
  });

  it('ignores a draft that belongs to another account', () => {
    expect(parseDraft(stored({ userId: 'user-2' }), USER, NOW)).toBeNull();
  });

  it('ignores drafts without an owner or a timestamp', () => {
    expect(parseDraft(JSON.stringify(draft), USER, NOW)).toBeNull();
    expect(parseDraft(stored({ savedAt: 'yesterday' }), USER, NOW)).toBeNull();
  });

  it('drops drafts older than seven days but keeps younger ones', () => {
    expect(DRAFT_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDraft(stored(), USER, NOW + DRAFT_MAX_AGE_MS)).toEqual(draft);
    expect(parseDraft(stored(), USER, NOW + DRAFT_MAX_AGE_MS + 1)).toBeNull();
  });

  it('rejects garbage, empty drafts and wrong shapes', () => {
    expect(parseDraft(null, USER, NOW)).toBeNull();
    expect(parseDraft('not json', USER, NOW)).toBeNull();
    expect(parseDraft('[]', USER, NOW)).toBeNull();
    expect(parseDraft(stored({ title: 1 }), USER, NOW)).toBeNull();
    expect(parseDraft(stored({ title: ' ', body: '  ' }), USER, NOW)).toBeNull();
  });

  it('drops invalid optional fields instead of failing', () => {
    const parsed = parseDraft(stored({ date: '2026-99-99', time: 'late', personIds: ['a', 3] }), USER, NOW);
    expect(parsed).toMatchObject({ date: null, time: null, hasTime: false, personIds: ['a'] });
  });

  it('knows when a draft is empty', () => {
    expect(isDraftEmpty({ ...draft, body: '', title: ' ' })).toBe(true);
    expect(isDraftEmpty(draft)).toBe(false);
  });
});

describe('draft storage', () => {
  const draft: JournalDraft = {
    title: 'T',
    body: 'Body',
    date: null,
    time: null,
    hasTime: false,
    personIds: [],
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('puts the account id into every key', () => {
    expect(newEntryDraftKey('user-1')).toContain('user-1');
    expect(editEntryDraftKey('user-1', 'e1')).toContain('user-1');
    expect(newEntryDraftKey('user-1')).not.toBe(newEntryDraftKey('user-2'));
    expect(editEntryDraftKey('user-1', 'e1')).not.toBe(editEntryDraftKey('user-1', 'e2'));
    expect(editEntryDraftKey('user-1', 'e1')).not.toBe(newEntryDraftKey('user-1'));
    expect(newEntryDraftKey('user-1').startsWith(JOURNAL_DRAFT_PREFIX)).toBe(true);
  });

  it('stores, reads and clears a draft', () => {
    const key = newEntryDraftKey(USER);
    expect(writeDraft(key, USER, draft, NOW)).toBe(true);
    expect(readDraft(key, USER, NOW)).toEqual(draft);
    clearDraft(key);
    expect(readDraft(key, USER, NOW)).toBeNull();
  });

  it('does not hand a draft to another account, even under the same key', () => {
    const key = newEntryDraftKey(USER);
    writeDraft(key, USER, draft, NOW);
    expect(readDraft(key, 'user-2', NOW)).toBeNull();
    // The foreign entry is removed rather than left lying around.
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('discards and removes an expired draft when it is read', () => {
    const key = newEntryDraftKey(USER);
    writeDraft(key, USER, draft, NOW);
    expect(readDraft(key, USER, NOW + DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('removes the stored draft when the text is emptied', () => {
    const key = newEntryDraftKey(USER);
    writeDraft(key, USER, draft, NOW);
    writeDraft(key, USER, { ...draft, title: '', body: '' }, NOW);
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('leaves no journal draft behind when the browser storage is cleared on sign out', () => {
    writeDraft(newEntryDraftKey('user-1'), 'user-1', draft, NOW);
    writeDraft(editEntryDraftKey('user-2', 'e1'), 'user-2', draft, NOW);
    window.localStorage.setItem('theme', 'dark');
    clearNametagStorage();
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });

  it('purges expired and unreadable drafts but keeps fresh ones', () => {
    const fresh = newEntryDraftKey('user-1');
    const old = newEntryDraftKey('user-2');
    writeDraft(fresh, 'user-1', draft, NOW);
    writeDraft(old, 'user-2', draft, NOW - DRAFT_MAX_AGE_MS - 1);
    window.localStorage.setItem(`${JOURNAL_DRAFT_PREFIX}user-3:new`, 'garbage');
    purgeStaleJournalDrafts(NOW);
    expect(window.localStorage.getItem(fresh)).not.toBeNull();
    expect(window.localStorage.getItem(old)).toBeNull();
    expect(window.localStorage.getItem(`${JOURNAL_DRAFT_PREFIX}user-3:new`)).toBeNull();
  });

  it('does not throw when storage is blocked', () => {
    const key = newEntryDraftKey(USER);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readDraft(key, USER)).toBeNull();
    expect(writeDraft(key, USER, draft)).toBe(false);
    expect(() => clearDraft(key)).not.toThrow();
    expect(() => purgeStaleJournalDrafts()).not.toThrow();
  });
});
