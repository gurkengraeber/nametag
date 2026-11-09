import { describe, it, expect } from 'vitest';
import { searchGraphPeople } from '../../../components/graph/search-people';
import type { RawGraphPerson } from '../../../components/graph/bubble-composition';

const person = (id: string, label: string, isCenter = false): RawGraphPerson => ({
  id, label, groups: [], colors: [], isCenter,
});

const people = [
  person('u', 'You', true),
  person('1', 'Marta Vogel'),
  person('2', 'Tom Martin'),
  person('3', 'Ámbar Schmidt'),
  person('4', 'Karl-Heinz Mart'),
  person('5', 'Lena Brandt'),
];

describe('searchGraphPeople', () => {
  it('returns nothing for an empty query', () => {
    expect(searchGraphPeople(people, '')).toEqual([]);
    expect(searchGraphPeople(people, '   ')).toEqual([]);
  });

  it('ranks names starting with the query before names with a later word start', () => {
    const hits = searchGraphPeople(people, 'mart').map((p) => p.id);
    expect(hits).toEqual(['1', '4', '2']);
  });

  it('ignores case and accents', () => {
    expect(searchGraphPeople(people, 'AMBAR').map((p) => p.id)).toEqual(['3']);
    expect(searchGraphPeople(people, 'ámbar').map((p) => p.id)).toEqual(['3']);
  });

  it('matches inside a name', () => {
    expect(searchGraphPeople(people, 'randt').map((p) => p.id)).toEqual(['5']);
  });

  it('never returns the center node and respects the limit', () => {
    expect(searchGraphPeople(people, 'you')).toEqual([]);
    expect(searchGraphPeople(people, 'a', 2)).toHaveLength(2);
  });
});
