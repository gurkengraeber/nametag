import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  recentPersonIds,
  parseDraft,
  readDraft,
  writeDraft,
  clearDraft,
  isDraftEmpty,
  editEntryDraftKey,
  NEW_ENTRY_DRAFT_KEY,
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

describe('draft parsing', () => {
  const draft: JournalDraft = {
    title: '',
    body: 'Half written',
    date: '2026-11-01',
    time: '09:30',
    hasTime: true,
    personIds: ['p1'],
  };

  it('round trips a draft', () => {
    expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
  });

  it('rejects garbage, empty drafts and wrong shapes', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('not json')).toBeNull();
    expect(parseDraft('[]')).toBeNull();
    expect(parseDraft(JSON.stringify({ title: 1, body: 'x' }))).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft, title: ' ', body: '  ' }))).toBeNull();
  });

  it('drops invalid optional fields instead of failing', () => {
    const parsed = parseDraft(JSON.stringify({ ...draft, date: '2026-99-99', time: 'late', personIds: ['a', 3] }));
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

  it('stores, reads and clears a draft', () => {
    expect(writeDraft(NEW_ENTRY_DRAFT_KEY, draft)).toBe(true);
    expect(readDraft(NEW_ENTRY_DRAFT_KEY)).toEqual(draft);
    clearDraft(NEW_ENTRY_DRAFT_KEY);
    expect(readDraft(NEW_ENTRY_DRAFT_KEY)).toBeNull();
  });

  it('removes the stored draft when the text is emptied', () => {
    writeDraft(NEW_ENTRY_DRAFT_KEY, draft);
    writeDraft(NEW_ENTRY_DRAFT_KEY, { ...draft, title: '', body: '' });
    expect(window.localStorage.getItem(NEW_ENTRY_DRAFT_KEY)).toBeNull();
  });

  it('keeps edit drafts apart per entry', () => {
    expect(editEntryDraftKey('e1')).not.toBe(editEntryDraftKey('e2'));
    expect(editEntryDraftKey('e1')).not.toBe(NEW_ENTRY_DRAFT_KEY);
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readDraft(NEW_ENTRY_DRAFT_KEY)).toBeNull();
    expect(writeDraft(NEW_ENTRY_DRAFT_KEY, draft)).toBe(false);
    expect(() => clearDraft(NEW_ENTRY_DRAFT_KEY)).not.toThrow();
  });
});
