import { describe, it, expect } from 'vitest';
import {
  editDistance,
  findSimilarName,
  normalizeNameForComparison,
} from '../../lib/name-similarity';

const names = (list: string[]) => list.map((name) => ({ name }));
const find = (input: string, list: string[]) =>
  findSimilarName(input, names(list), (item) => item.name);

describe('normalizeNameForComparison', () => {
  it('ignores case, accents, spaces and punctuation', () => {
    expect(normalizeNameForComparison('  Best-Friend ')).toBe('bestfriend');
    expect(normalizeNameForComparison('Bést friend')).toBe('bestfriend');
    expect(normalizeNameForComparison('Zoë')).toBe('zoe');
  });

  it('keeps letters of other scripts', () => {
    expect(normalizeNameForComparison('友達')).toBe('友達');
    expect(normalizeNameForComparison('Друг!')).toBe('друг');
  });

  it('returns an empty string for punctuation only', () => {
    expect(normalizeNameForComparison(' - . ')).toBe('');
  });
});

describe('editDistance', () => {
  it('counts insertions, deletions and substitutions', () => {
    expect(editDistance('friend', 'friend')).toBe(0);
    expect(editDistance('friend', 'friends')).toBe(1);
    expect(editDistance('friend', 'freind')).toBe(2);
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('findSimilarName', () => {
  it('reports an exact match when only case or spacing differs', () => {
    const match = find('best friend', ['Family', 'Best-Friend']);
    expect(match).toEqual({ item: { name: 'Best-Friend' }, exact: true });
  });

  it('reports a near match for a single typo', () => {
    const match = find('Colleagues', ['Colleages', 'Family']);
    expect(match?.exact).toBe(false);
    expect(match?.item.name).toBe('Colleages');
  });

  it('prefers an exact match over a near match', () => {
    const match = find('Friends', ['Friend', 'Friends']);
    expect(match).toEqual({ item: { name: 'Friends' }, exact: true });
  });

  it('allows two edits only for long names', () => {
    expect(find('Neighbourhood', ['Neighborhod'])?.exact).toBe(false);
    expect(find('Mentor', ['Mentee'])).toBeNull();
  });

  it('does not flag very short names that merely look alike', () => {
    expect(find('Dad', ['Mad'])).toBeNull();
  });

  it('matches short names only when identical', () => {
    expect(find('Mom', ['mom'])?.exact).toBe(true);
  });

  it('returns null for empty input or unrelated names', () => {
    expect(find('', ['Family'])).toBeNull();
    expect(find('   ', ['Family'])).toBeNull();
    expect(find('Work', ['Family', 'School'])).toBeNull();
  });
});
