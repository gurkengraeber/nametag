import { describe, it, expect } from 'vitest';
import {
  createSearchIndex,
  fuzzyForTerm,
  getIndexedPerson,
  nameMatchBonus,
  pickMatchHint,
  searchIndex,
} from '@/lib/search-index';
import type { SearchDocument } from '@/lib/search-index';

function doc(overrides: Partial<SearchDocument> & { id: string; name: string }): SearchDocument {
  return {
    surname: null,
    middleName: null,
    secondLastName: null,
    nickname: null,
    organization: null,
    jobTitle: null,
    notes: null,
    phones: '',
    emails: '',
    addresses: '',
    urls: '',
    imHandles: '',
    groups: '',
    customFields: '',
    photo: null,
    ...overrides,
  };
}

describe('nameMatchBonus', () => {
  it('rewards a name that starts with the typed word', () => {
    expect(nameMatchBonus({ name: 'Anna' }, 'ann')).toBeGreaterThan(nameMatchBonus({ name: 'Joanna' }, 'ann'));
  });

  it('rewards the exact word more than a prefix', () => {
    expect(nameMatchBonus({ name: 'Ann' }, 'ann')).toBeGreaterThan(nameMatchBonus({ name: 'Anna' }, 'ann'));
  });

  it('rewards the full name in either order', () => {
    const person = { name: 'Ada', surname: 'Lovelace' };
    expect(nameMatchBonus(person, 'ada lovelace')).toBeGreaterThan(nameMatchBonus(person, 'ada'));
    expect(nameMatchBonus(person, 'lovelace ada')).toBe(nameMatchBonus(person, 'ada lovelace'));
  });

  it('ignores accents and case', () => {
    expect(nameMatchBonus({ name: 'María' }, 'MARIA')).toBeGreaterThan(0);
  });

  it('is zero when nothing in the name matches', () => {
    expect(nameMatchBonus({ name: 'Ada' }, 'berlin')).toBe(0);
    expect(nameMatchBonus({ name: 'Ada' }, '   ')).toBe(0);
  });
});

describe('fuzzyForTerm', () => {
  it('skips typo tolerance for very short words', () => {
    expect(fuzzyForTerm('ann')).toBe(false);
    expect(fuzzyForTerm('anna')).toBe(0.2);
  });
});

describe('pickMatchHint', () => {
  it('returns null when only names matched', () => {
    expect(pickMatchHint({ ada: ['name'], love: ['surname'] })).toBeNull();
    expect(pickMatchHint(undefined)).toBeNull();
  });

  it('explains a hit that was found outside the name', () => {
    expect(pickMatchHint({ berlin: ['notes'] })).toBe('notes');
    expect(pickMatchHint({ berlin: ['locality', 'addresses'] })).toBe('locality');
  });

  it('prefers the most telling field', () => {
    expect(pickMatchHint({ chess: ['notes', 'groups'] })).toBe('group');
  });

  it('ignores words that the name already explains', () => {
    expect(pickMatchHint({ ada: ['name', 'notes'], berlin: ['locality'] })).toBe('locality');
    expect(pickMatchHint({ ada: ['name', 'notes'] })).toBeNull();
  });
});

describe('searchIndex ranking', () => {
  const documents = [
    doc({ id: 'note', name: 'Zed', notes: 'Met Berta at the conference' }),
    doc({ id: 'name', name: 'Berta', surname: 'Klein' }),
    doc({ id: 'group', name: 'Yan', groups: 'Berta fans', groupNames: ['Berta fans'], groupIds: ['g1'] }),
  ];

  it('puts the person named like the query before free-text mentions', () => {
    const results = searchIndex(createSearchIndex(documents), 'Berta');
    expect(results[0].id).toBe('name');
    expect(results.map((r) => r.id)).toEqual(expect.arrayContaining(['note', 'group']));
  });

  it('ranks a group match above a notes match', () => {
    const results = searchIndex(createSearchIndex(documents), 'Berta');
    expect(results.findIndex((r) => r.id === 'group')).toBeLessThan(results.findIndex((r) => r.id === 'note'));
  });

  it('flags where a non-name hit was found', () => {
    const results = searchIndex(createSearchIndex(documents), 'Berta');
    expect(results.find((r) => r.id === 'note')?.matchedIn).toBe('notes');
    expect(results.find((r) => r.id === 'group')?.matchedIn).toBe('group');
    expect(results.find((r) => r.id === 'name')?.matchedIn).toBeNull();
  });

  it('finds people by relationship and by place', () => {
    const index = createSearchIndex([
      doc({ id: 'a', name: 'Ada', relationship: 'Colleague', locality: 'Lisbon' }),
      doc({ id: 'b', name: 'Bo' }),
    ]);
    expect(searchIndex(index, 'colleague').map((r) => r.id)).toEqual(['a']);
    expect(searchIndex(index, 'Lisbon')[0].matchedIn).toBe('locality');
  });

  it('does not match short words by typo', () => {
    const index = createSearchIndex([doc({ id: 'a', name: 'Amy' }), doc({ id: 'b', name: 'Ann' })]);
    expect(searchIndex(index, 'Ann').map((r) => r.id)).toEqual(['b']);
  });

  it('carries the context shown next to a hit', () => {
    const index = createSearchIndex([
      doc({
        id: 'a',
        name: 'Ada',
        relationship: 'Friend',
        relationshipTypeId: 'rt1',
        locality: 'Lisbon',
        groupIds: ['g1'],
        groupNames: ['Chess'],
        lastContact: '2026-01-02',
      }),
    ]);
    const [hit] = searchIndex(index, 'Ada');
    expect(hit).toMatchObject({
      relationship: 'Friend',
      relationshipTypeId: 'rt1',
      locality: 'Lisbon',
      groupIds: ['g1'],
      groupNames: ['Chess'],
      lastContact: '2026-01-02',
    });
  });
});

describe('getIndexedPerson', () => {
  it('returns the stored person for an id and null for an unknown one', () => {
    const index = createSearchIndex([doc({ id: 'a', name: 'Ada', groupNames: ['Chess'] })]);
    expect(getIndexedPerson(index, 'a')).toMatchObject({ id: 'a', name: 'Ada', groupNames: ['Chess'] });
    expect(getIndexedPerson(index, 'nope')).toBeNull();
  });
});
