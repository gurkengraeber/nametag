import { describe, it, expect } from 'vitest';
import {
  getRelativeTime,
  getNextImportantDate,
  appendNote,
  diffIds,
  getImHandleHref,
  MAX_NOTES_LENGTH,
} from '@/lib/person-profile';

const NOW = new Date(2026, 10, 9, 15, 30); // 9 Nov 2026, local time

describe('getRelativeTime', () => {
  it('reports today, yesterday and days', () => {
    expect(getRelativeTime(new Date(2026, 10, 9), NOW)).toEqual({ key: 'today' });
    expect(getRelativeTime(new Date(2026, 10, 8), NOW)).toEqual({ key: 'oneDayAgo' });
    expect(getRelativeTime(new Date(2026, 10, 2), NOW)).toEqual({ key: 'daysAgo', values: { days: 7 } });
  });

  it('switches to months after four weeks', () => {
    expect(getRelativeTime(new Date(2026, 9, 9), NOW)).toEqual({ key: 'oneMonthAgo' });
    expect(getRelativeTime(new Date(2026, 7, 9), NOW)).toEqual({ key: 'monthsAgo', values: { months: 3 } });
  });

  it('switches to years after twelve months', () => {
    expect(getRelativeTime(new Date(2025, 10, 9), NOW)).toEqual({ key: 'oneYearAgo' });
    expect(getRelativeTime(new Date(2023, 10, 9), NOW)).toEqual({ key: 'yearsAgo', values: { years: 3 } });
  });

  it('treats future dates as today', () => {
    expect(getRelativeTime(new Date(2026, 11, 24), NOW)).toEqual({ key: 'today' });
  });

  it('keeps days for a short span that crosses a month boundary', () => {
    expect(getRelativeTime(new Date(2026, 9, 12), NOW)).toEqual({ key: 'daysAgo', values: { days: 28 } });
  });
});

describe('getNextImportantDate', () => {
  const birthday = {
    id: 'b',
    type: 'birthday',
    title: 'Birthday',
    date: new Date(Date.UTC(1990, 11, 1)),
  };
  const anniversary = {
    id: 'a',
    type: 'anniversary',
    title: 'Anniversary',
    date: new Date(Date.UTC(2015, 10, 9)),
  };

  it('returns null without dates', () => {
    expect(getNextImportantDate([], NOW)).toBeNull();
  });

  it('picks the soonest yearly date', () => {
    const next = getNextImportantDate([birthday, anniversary], NOW);
    expect(next?.item.id).toBe('a');
    expect(next?.daysUntil).toBe(0);
  });

  it('rolls a passed yearly date over to next year', () => {
    const next = getNextImportantDate([{ ...birthday, date: new Date(Date.UTC(1990, 0, 5)) }], NOW);
    expect(next?.date.getFullYear()).toBe(2027);
    expect(next?.daysUntil).toBe(57);
  });

  it('treats a year-unknown date as yearly', () => {
    const next = getNextImportantDate(
      [{ id: 'u', type: null, title: 'Name day', date: new Date(Date.UTC(1604, 11, 6)) }],
      NOW
    );
    expect(next?.isYearUnknown).toBe(true);
    expect(next?.daysUntil).toBe(27);
  });

  it('ignores past one-time custom dates but keeps future ones', () => {
    const past = { id: 'p', type: null, title: 'Met', date: new Date(Date.UTC(2020, 5, 1)) };
    const future = { id: 'f', type: null, title: 'Trip', date: new Date(Date.UTC(2027, 1, 1)) };
    expect(getNextImportantDate([past], NOW)).toBeNull();
    expect(getNextImportantDate([past, future], NOW)?.item.id).toBe('f');
  });

  it('repeats a custom date that has a recurring reminder', () => {
    const custom = {
      id: 'c',
      type: null,
      title: 'Moved here',
      date: new Date(Date.UTC(2020, 10, 20)),
      reminderType: 'RECURRING',
    };
    expect(getNextImportantDate([custom], NOW)?.daysUntil).toBe(11);
  });
});

describe('appendNote', () => {
  it('starts notes when there are none', () => {
    expect(appendNote(null, '  Called about the trip ')).toBe('Called about the trip');
  });

  it('separates notes with a blank line', () => {
    expect(appendNote('First note\n', 'Second')).toBe('First note\n\nSecond');
  });

  it('rejects empty additions and notes that grow past the limit', () => {
    expect(appendNote('x', '   ')).toBeNull();
    expect(appendNote('a'.repeat(MAX_NOTES_LENGTH - 1), 'bb')).toBeNull();
    expect(appendNote('a'.repeat(MAX_NOTES_LENGTH - 5), 'bb')).not.toBeNull();
  });
});

describe('diffIds', () => {
  it('lists added and removed ids', () => {
    expect(diffIds(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
    expect(diffIds([], [])).toEqual({ added: [], removed: [] });
  });
});

describe('getImHandleHref', () => {
  it('builds Telegram links and strips the at sign', () => {
    expect(getImHandleHref('Telegram', '@max_example')).toBe('https://t.me/max_example');
  });

  it('builds Skype links', () => {
    expect(getImHandleHref('skype', 'max.example')).toBe('skype:max.example?chat');
  });

  it('returns null for unknown protocols, blanks and handles with spaces', () => {
    expect(getImHandleHref('WhatsApp', 'max')).toBeNull();
    expect(getImHandleHref('Telegram', '  ')).toBeNull();
    expect(getImHandleHref('Telegram', 'max example')).toBeNull();
  });
});
