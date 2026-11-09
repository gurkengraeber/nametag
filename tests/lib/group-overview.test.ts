import { describe, it, expect } from 'vitest';
import {
  filterGroups,
  parseGroupSort,
  sortGroups,
  visibleGroups,
  type OverviewGroup,
} from '../../lib/group-overview';

const group = (name: string, memberCount: number, description: string | null = null): OverviewGroup => ({
  id: name,
  name,
  description,
  color: null,
  memberCount,
});

const groups = [
  group('school', 4),
  group('Family', 12, 'Close relatives'),
  group('Work', 12),
  group('Zumba', 0),
];

describe('parseGroupSort', () => {
  it('accepts size and falls back to name', () => {
    expect(parseGroupSort('size')).toBe('size');
    expect(parseGroupSort('name')).toBe('name');
    expect(parseGroupSort('whatever')).toBe('name');
    expect(parseGroupSort(null)).toBe('name');
  });
});

describe('filterGroups', () => {
  it('returns everything for an empty query', () => {
    expect(filterGroups(groups, '  ')).toHaveLength(4);
  });

  it('matches name ignoring case and accents', () => {
    expect(filterGroups(groups, 'FAM').map((g) => g.name)).toEqual(['Family']);
    expect(filterGroups([group('Café', 1)], 'cafe')).toHaveLength(1);
  });

  it('also matches the description', () => {
    expect(filterGroups(groups, 'relatives').map((g) => g.name)).toEqual(['Family']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterGroups(groups, 'nothing')).toEqual([]);
  });
});

describe('sortGroups', () => {
  it('sorts by name ignoring case', () => {
    expect(sortGroups(groups, 'name').map((g) => g.name)).toEqual(['Family', 'school', 'Work', 'Zumba']);
  });

  it('sorts by size, biggest first, ties by name', () => {
    expect(sortGroups(groups, 'size').map((g) => g.name)).toEqual(['Family', 'Work', 'school', 'Zumba']);
  });

  it('does not change the input array', () => {
    const copy = [...groups];
    sortGroups(groups, 'size');
    expect(groups).toEqual(copy);
  });
});

describe('visibleGroups', () => {
  it('filters first, then sorts', () => {
    expect(visibleGroups(groups, 'o', 'size').map((g) => g.name)).toEqual(['Family', 'Work', 'school']);
  });
});
