import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MAX_RECENT_PEOPLE,
  forgetRecentPeople,
  freshEntries,
  personIdFromPath,
  readRecentPeople,
  rememberRecentPerson,
  withRecentPerson,
} from '@/lib/recent-people';

describe('personIdFromPath', () => {
  it('reads the id from a profile or edit page', () => {
    expect(personIdFromPath('/people/abc123')).toBe('abc123');
    expect(personIdFromPath('/people/abc123/edit')).toBe('abc123');
    expect(personIdFromPath('/people/abc123/')).toBe('abc123');
  });

  it('ignores pages that are not a profile', () => {
    expect(personIdFromPath('/people')).toBeNull();
    expect(personIdFromPath('/people/new')).toBeNull();
    expect(personIdFromPath('/people/merge')).toBeNull();
    expect(personIdFromPath('/people/duplicates')).toBeNull();
    expect(personIdFromPath('/groups/abc123')).toBeNull();
    expect(personIdFromPath('/people/abc123/other')).toBeNull();
  });

  it('does not throw on a broken percent escape in a typed address', () => {
    expect(personIdFromPath('/people/%E0%A4%A')).toBeNull();
  });
});

const NOW = Date.UTC(2026, 10, 9);
const DAY = 24 * 60 * 60 * 1000;

describe('withRecentPerson', () => {
  const entries = [
    { id: 'a', at: NOW - 3 },
    { id: 'b', at: NOW - 2 },
    { id: 'c', at: NOW - 1 },
  ];

  it('moves a person to the front without duplicates', () => {
    expect(withRecentPerson(entries, 'b', NOW).map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('caps the list', () => {
    const many = Array.from({ length: MAX_RECENT_PEOPLE }, (_, i) => ({ id: `p${i}`, at: NOW }));
    const next = withRecentPerson(many, 'new', NOW);
    expect(next).toHaveLength(MAX_RECENT_PEOPLE);
    expect(next[0]).toEqual({ id: 'new', at: NOW });
  });
});

describe('freshEntries', () => {
  it('drops entries older than 30 days', () => {
    const kept = freshEntries(
      [
        { id: 'new', at: NOW - 29 * DAY },
        { id: 'old', at: NOW - 31 * DAY },
      ],
      NOW
    );
    expect(kept.map((e) => e.id)).toEqual(['new']);
  });
});

describe('recent people storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('remembers people newest first', () => {
    rememberRecentPerson('u1', 'a', NOW);
    rememberRecentPerson('u1', 'b', NOW + 1);
    rememberRecentPerson('u1', 'a', NOW + 2);
    expect(readRecentPeople('u1', NOW + 3)).toEqual(['a', 'b']);
  });

  it('stores only ids and timestamps under a key that names the account', () => {
    rememberRecentPerson('u1', 'a', NOW);
    expect(Object.keys(window.localStorage)).toEqual(['nametag:recent-people:u1']);
    expect(JSON.parse(window.localStorage.getItem('nametag:recent-people:u1') ?? '')).toEqual({
      userId: 'u1',
      entries: [{ id: 'a', at: NOW }],
    });
  });

  it('keeps accounts apart', () => {
    rememberRecentPerson('u1', 'a', NOW);
    expect(readRecentPeople('u2', NOW)).toEqual([]);
  });

  it('refuses a value that was written for another account', () => {
    window.localStorage.setItem(
      'nametag:recent-people:u2',
      JSON.stringify({ userId: 'u1', entries: [{ id: 'a', at: NOW }] })
    );
    expect(readRecentPeople('u2', NOW)).toEqual([]);
  });

  it('does nothing without a known account', () => {
    rememberRecentPerson(undefined, 'a', NOW);
    expect(window.localStorage.length).toBe(0);
    expect(readRecentPeople(undefined, NOW)).toEqual([]);
  });

  it('expires old entries on read', () => {
    rememberRecentPerson('u1', 'old', NOW - 31 * DAY);
    rememberRecentPerson('u1', 'new', NOW - DAY);
    expect(readRecentPeople('u1', NOW)).toEqual(['new']);
  });

  it('forgets people that no longer exist', () => {
    rememberRecentPerson('u1', 'a', Date.now());
    rememberRecentPerson('u1', 'b', Date.now());
    forgetRecentPeople('u1', ['a']);
    expect(readRecentPeople('u1')).toEqual(['b']);
  });

  it('survives corrupt data', () => {
    const key = 'nametag:recent-people:u1';
    window.localStorage.setItem(key, '{not json');
    expect(readRecentPeople('u1', NOW)).toEqual([]);
    window.localStorage.setItem(key, '["a"]');
    expect(readRecentPeople('u1', NOW)).toEqual([]);
    window.localStorage.setItem(
      key,
      JSON.stringify({ userId: 'u1', entries: [{ id: 'a', at: NOW }, { id: 3, at: NOW }, 'x', { id: 'b' }] })
    );
    expect(readRecentPeople('u1', NOW)).toEqual(['a']);
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readRecentPeople('u1')).toEqual([]);
    expect(() => rememberRecentPerson('u1', 'a')).not.toThrow();
    expect(() => forgetRecentPeople('u1', ['a'])).not.toThrow();
  });
});
