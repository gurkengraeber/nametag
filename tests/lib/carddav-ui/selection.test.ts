import { describe, it, expect, vi } from 'vitest';
import {
  matchesAllWords,
  filterBySearch,
  toggleVisible,
  toggleOne,
  areAllSelected,
  pruneSelection,
  selectionStats,
  chunk,
  runInBatches,
} from '@/lib/carddav-ui/selection';

describe('matchesAllWords', () => {
  it('matches everything for an empty query', () => {
    expect(matchesAllWords(['Ada Example'], '')).toBe(true);
    expect(matchesAllWords([], '   ')).toBe(true);
  });

  it('ignores case and accents', () => {
    expect(matchesAllWords(['José Pérez'], 'jose perez')).toBe(true);
    expect(matchesAllWords(['ADA'], 'ada')).toBe(true);
  });

  it('requires every word, across different parts', () => {
    expect(matchesAllWords(['Ada', 'Example GmbH'], 'ada gmbh')).toBe(true);
    expect(matchesAllWords(['Ada', 'Example GmbH'], 'ada berlin')).toBe(false);
  });

  it('skips empty parts', () => {
    expect(matchesAllWords([null, undefined, 'Ada'], 'ada')).toBe(true);
  });
});

describe('filterBySearch', () => {
  const people = [
    { id: '1', name: 'Ada Example', org: 'Analytical Engines' },
    { id: '2', name: 'Grace Sample', org: null },
  ];

  it('returns all items for a blank query', () => {
    expect(filterBySearch(people, '  ', (p) => [p.name, p.org])).toHaveLength(2);
  });

  it('filters on the given parts', () => {
    expect(filterBySearch(people, 'engines', (p) => [p.name, p.org]).map((p) => p.id)).toEqual(['1']);
  });
});

describe('visible selection', () => {
  const visible = ['b', 'c'];

  it('selects only the visible ids and keeps hidden selections', () => {
    const next = toggleVisible(new Set(['a']), visible);
    expect([...next].sort()).toEqual(['a', 'b', 'c']);
  });

  it('never selects ids that are not visible', () => {
    const next = toggleVisible(new Set(), visible);
    expect(next.has('a')).toBe(false);
  });

  it('deselects only the visible ids when all of them are selected', () => {
    const next = toggleVisible(new Set(['a', 'b', 'c']), visible);
    expect([...next]).toEqual(['a']);
  });

  it('completes a partial selection instead of clearing it', () => {
    const next = toggleVisible(new Set(['b']), visible);
    expect([...next].sort()).toEqual(['b', 'c']);
  });

  it('does nothing for an empty visible list', () => {
    expect(toggleVisible(new Set(['a']), []).size).toBe(1);
    expect(areAllSelected(new Set(['a']), [])).toBe(false);
  });

  it('toggles a single id', () => {
    expect(toggleOne(new Set(['a']), 'b').has('b')).toBe(true);
    expect(toggleOne(new Set(['a']), 'a').has('a')).toBe(false);
  });

  it('prunes ids that disappeared from the list', () => {
    expect([...pruneSelection(new Set(['a', 'x']), ['a', 'b'])]).toEqual(['a']);
  });

  it('counts selected ids inside and outside the visible list', () => {
    expect(selectionStats(new Set(['a', 'b']), visible)).toEqual({
      total: 2,
      visibleSelected: 1,
      hiddenSelected: 1,
    });
  });
});

describe('chunk', () => {
  it('splits into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no batches for an empty list', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it('rejects a size below one', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe('runInBatches', () => {
  it('runs batches in order and reports progress', async () => {
    const progress = vi.fn();
    const run = vi.fn(async (batch: number[]) => batch.length);
    const result = await runInBatches([1, 2, 3, 4, 5], 2, run, progress);
    expect(result.results).toEqual([2, 2, 1]);
    expect(result.processed).toBe(5);
    expect(result.error).toBeNull();
    expect(progress.mock.calls).toEqual([[0, 5], [2, 5], [4, 5], [5, 5]]);
  });

  it('stops at the first failing batch and keeps earlier results', async () => {
    const boom = new Error('boom');
    const run = vi
      .fn<(batch: number[]) => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(boom);
    const result = await runInBatches([1, 2, 3, 4, 5, 6], 2, run);
    expect(result.results).toEqual(['first']);
    expect(result.processed).toBe(2);
    expect(result.error).toBe(boom);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
