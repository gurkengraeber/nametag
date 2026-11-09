import { describe, it, expect } from 'vitest';
import {
  filterByLabel,
  selectionState,
  setAllSelected,
  toggleSelected,
} from '../../lib/people-selection';

const items = [
  { id: '1', label: 'Anna Müller' },
  { id: '2', label: 'Ben Smith' },
  { id: '3', label: 'Zoë Brown' },
];

describe('filterByLabel', () => {
  it('returns all items for an empty query', () => {
    expect(filterByLabel(items, '')).toHaveLength(3);
    expect(filterByLabel(items, '  ')).toHaveLength(3);
  });

  it('ignores case and accents', () => {
    expect(filterByLabel(items, 'muller').map((i) => i.id)).toEqual(['1']);
    expect(filterByLabel(items, 'ZOE').map((i) => i.id)).toEqual(['3']);
  });

  it('matches anywhere in the label', () => {
    expect(filterByLabel(items, 'smi').map((i) => i.id)).toEqual(['2']);
  });
});

describe('toggleSelected', () => {
  it('adds and removes without changing the input', () => {
    const empty = new Set<string>();
    const one = toggleSelected(empty, 'a');
    expect([...one]).toEqual(['a']);
    expect(empty.size).toBe(0);
    expect(toggleSelected(one, 'a').size).toBe(0);
  });
});

describe('setAllSelected', () => {
  it('ticks the given ids and keeps others', () => {
    const next = setAllSelected(new Set(['x']), ['a', 'b'], true);
    expect([...next].sort()).toEqual(['a', 'b', 'x']);
  });

  it('unticks only the given ids', () => {
    const next = setAllSelected(new Set(['x', 'a', 'b']), ['a', 'b'], false);
    expect([...next]).toEqual(['x']);
  });
});

describe('selectionState', () => {
  it('reports none, some and all', () => {
    expect(selectionState(new Set(), ['a', 'b'])).toBe('none');
    expect(selectionState(new Set(['a']), ['a', 'b'])).toBe('some');
    expect(selectionState(new Set(['a', 'b', 'c']), ['a', 'b'])).toBe('all');
  });

  it('is none for an empty list', () => {
    expect(selectionState(new Set(['a']), [])).toBe('none');
  });
});
