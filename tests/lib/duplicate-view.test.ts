import { describe, it, expect } from 'vitest';
import {
  buildSuggestions,
  countOpenSuggestions,
  filterSuggestions,
  formatList,
  groupByConfidence,
  pairKey,
  type DuplicateGroupDisplay,
} from '@/lib/duplicate-view';

const people = {
  a: { id: 'a', name: 'Ann', surname: 'Lee' },
  b: { id: 'b', name: 'Anne', surname: 'Lee' },
  c: { id: 'c', name: 'Bo', surname: null },
  d: { id: 'd', name: 'Bob', surname: null },
};

const groups: DuplicateGroupDisplay[] = [
  {
    people: [people.c, people.d],
    similarity: 0.8,
    pairs: [{ personAId: 'c', personBId: 'd', similarity: 0.8, reasons: ['similarName'] }],
  },
  {
    people: [people.a, people.b],
    similarity: 0.97,
    pairs: [{ personAId: 'a', personBId: 'b', similarity: 0.97, reasons: ['sameName', 'sameEmail'] }],
  },
];

describe('pairKey', () => {
  it('is independent of the order of the ids', () => {
    expect(pairKey('b', 'a')).toBe('a:b');
    expect(pairKey('a', 'b')).toBe('a:b');
  });
});

describe('buildSuggestions', () => {
  it('flattens groups into pairs, most similar first, with a confidence', () => {
    const suggestions = buildSuggestions(groups);
    expect(suggestions.map((s) => s.key)).toEqual(['a:b', 'c:d']);
    expect(suggestions[0].confidence).toBe('high');
    expect(suggestions[1].confidence).toBe('low');
  });

  it('falls back to every combination for groups without pairs', () => {
    const legacy: DuplicateGroupDisplay[] = [
      { people: [people.a, people.b, people.c], similarity: 0.9 },
    ];
    const suggestions = buildSuggestions(legacy);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.every((s) => s.reasons.length === 0)).toBe(true);
  });

  it('ignores pairs that point at unknown people and repeated pairs', () => {
    const odd: DuplicateGroupDisplay[] = [
      {
        people: [people.a, people.b],
        similarity: 0.9,
        pairs: [
          { personAId: 'a', personBId: 'zzz', similarity: 0.9, reasons: [] },
          { personAId: 'a', personBId: 'b', similarity: 0.9, reasons: [] },
          { personAId: 'b', personBId: 'a', similarity: 0.9, reasons: [] },
        ],
      },
    ];
    expect(buildSuggestions(odd)).toHaveLength(1);
  });
});

describe('filterSuggestions and counting', () => {
  it('drops dismissed pairs and pairs with removed contacts', () => {
    const suggestions = buildSuggestions(groups);
    expect(filterSuggestions(suggestions, new Set(['a:b']), new Set()).map((s) => s.key)).toEqual(['c:d']);
    expect(filterSuggestions(suggestions, new Set(), new Set(['d'])).map((s) => s.key)).toEqual(['a:b']);
  });

  it('counts open suggestions', () => {
    expect(countOpenSuggestions(groups)).toBe(2);
    expect(countOpenSuggestions([])).toBe(0);
  });
});

describe('groupByConfidence', () => {
  it('orders sections high to low and skips empty ones', () => {
    const sections = groupByConfidence(buildSuggestions(groups));
    expect(sections.map((s) => s.confidence)).toEqual(['high', 'low']);
  });
});

describe('formatList', () => {
  it('joins reasons with a locale aware conjunction', () => {
    expect(formatList(['same name', 'same email'], 'en')).toBe('same name and same email');
    expect(formatList(['a', 'b', 'c'], 'en')).toBe('a, b, and c');
    expect(formatList(['only'], 'en')).toBe('only');
    expect(formatList([], 'en')).toBe('');
  });
});
