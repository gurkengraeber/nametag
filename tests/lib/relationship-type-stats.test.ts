import { describe, it, expect } from 'vitest';
import { countConnections, getDeleteImpact } from '../../lib/relationship-type-stats';

describe('countConnections', () => {
  it('halves the rows of a symmetric type', () => {
    expect(countConnections(6, { id: 'friend', inverseId: 'friend' })).toBe(3);
  });

  it('halves the rows of a type without inverse', () => {
    expect(countConnections(4, { id: 'other', inverseId: null })).toBe(2);
  });

  it('counts every row of a type with a separate inverse', () => {
    expect(countConnections(5, { id: 'parent', inverseId: 'child' })).toBe(5);
  });

  it('handles zero and odd leftovers', () => {
    expect(countConnections(0, { id: 'a', inverseId: 'a' })).toBe(0);
    expect(countConnections(1, { id: 'a', inverseId: 'a' })).toBe(1);
  });
});

describe('getDeleteImpact', () => {
  it('is blocked while connections between people use the type', () => {
    expect(getDeleteImpact(3, 1)).toBe('blocked');
    expect(getDeleteImpact(0, 2)).toBe('blocked');
  });

  it('warns about people when only your own relationships use it', () => {
    expect(getDeleteImpact(2, 0)).toBe('people');
  });

  it('is unused when nothing refers to it', () => {
    expect(getDeleteImpact(0, 0)).toBe('unused');
  });
});
