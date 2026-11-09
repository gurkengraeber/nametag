import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MAX_RECENT_PEOPLE,
  forgetRecentPeople,
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
});

describe('withRecentPerson', () => {
  it('moves a person to the front without duplicates', () => {
    expect(withRecentPerson(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('caps the list', () => {
    const many = Array.from({ length: MAX_RECENT_PEOPLE }, (_, i) => `p${i}`);
    const next = withRecentPerson(many, 'new');
    expect(next).toHaveLength(MAX_RECENT_PEOPLE);
    expect(next[0]).toBe('new');
  });
});

describe('recent people storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('remembers people newest first', () => {
    rememberRecentPerson('a');
    rememberRecentPerson('b');
    rememberRecentPerson('a');
    expect(readRecentPeople()).toEqual(['a', 'b']);
  });

  it('forgets people that no longer exist', () => {
    rememberRecentPerson('a');
    rememberRecentPerson('b');
    forgetRecentPeople(['a']);
    expect(readRecentPeople()).toEqual(['b']);
  });

  it('survives corrupt data', () => {
    window.localStorage.setItem('nametag:recent-people', '{not json');
    expect(readRecentPeople()).toEqual([]);
    window.localStorage.setItem('nametag:recent-people', '{"a":1}');
    expect(readRecentPeople()).toEqual([]);
    window.localStorage.setItem('nametag:recent-people', '["a", 3, "b"]');
    expect(readRecentPeople()).toEqual(['a', 'b']);
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readRecentPeople()).toEqual([]);
    expect(() => rememberRecentPerson('a')).not.toThrow();
    expect(() => forgetRecentPeople(['a'])).not.toThrow();
  });
});
