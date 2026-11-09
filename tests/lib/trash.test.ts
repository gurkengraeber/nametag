import { describe, it, expect } from 'vitest';
import {
  emptyItemsByType,
  entryKey,
  filterEntries,
  getDaysRemaining,
  getLinkedEntries,
  getPermanentDeleteUrl,
  getRestoreUrl,
  isRemovalUrgent,
  mergeEntries,
  type DeletedImportantDate,
  type DeletedPerson,
  type DeletedRelationship,
  type TrashEntry,
} from '@/lib/trash';

const now = new Date('2026-03-31T12:00:00.000Z');

function person(id: string, name: string, deletedAt: string): DeletedPerson {
  return { id, name, surname: null, nickname: null, displayNameOverride: null, deletedAt };
}

function relationship(id: string, a: string, b: string): DeletedRelationship {
  return {
    id,
    deletedAt: '2026-03-30T00:00:00.000Z',
    person: { id: a, name: a, surname: null },
    relatedPerson: { id: b, name: b, surname: null },
    relationshipType: { id: 't', label: 'Friend' },
  };
}

describe('getDaysRemaining', () => {
  it('counts whole days left of the retention period, rounding up', () => {
    expect(getDaysRemaining('2026-03-31T12:00:00.000Z', 30, now)).toBe(30);
    expect(getDaysRemaining('2026-03-19T12:00:00.000Z', 30, now)).toBe(18);
    expect(getDaysRemaining('2026-03-01T13:00:00.000Z', 30, now)).toBe(1);
  });

  it('never goes below zero', () => {
    expect(getDaysRemaining('2025-01-01T00:00:00.000Z', 30, now)).toBe(0);
  });

  it('honours a custom retention period', () => {
    expect(getDaysRemaining('2026-03-31T12:00:00.000Z', 7, now)).toBe(7);
  });
});

describe('isRemovalUrgent', () => {
  it('flags a week or less', () => {
    expect(isRemovalUrgent(7)).toBe(true);
    expect(isRemovalUrgent(8)).toBe(false);
  });
});

describe('urls', () => {
  it('builds restore and permanent delete urls per type', () => {
    const date: DeletedImportantDate = {
      id: 'd1', title: 'Birthday', date: '2000-01-01T00:00:00.000Z', deletedAt: '2026-03-30T00:00:00.000Z',
      person: { id: 'p9', name: 'Eve', surname: null },
    };
    expect(getRestoreUrl('people', person('p1', 'Ann', ''))).toBe('/api/people/p1/restore');
    expect(getPermanentDeleteUrl('groups', person('g1', 'G', ''))).toBe('/api/groups/g1/permanent');
    expect(getRestoreUrl('importantDates', date)).toBe('/api/people/p9/important-dates/d1/restore');
    expect(getPermanentDeleteUrl('relationshipTypes', person('t1', 'T', ''))).toBe('/api/relationship-types/t1/permanent');
  });
});

describe('getLinkedEntries', () => {
  it('returns a relationship together with its inverse', () => {
    const r1 = { type: 'relationships' as const, item: relationship('r1', 'a', 'b') };
    const r2 = { type: 'relationships' as const, item: relationship('r2', 'b', 'a') };
    const other = { type: 'relationships' as const, item: relationship('r3', 'a', 'c') };
    const linked = getLinkedEntries(r1, [r1, r2, other]);
    expect(linked.map((e) => e.item.id).sort()).toEqual(['r1', 'r2']);
  });

  it('returns just the entry for other types', () => {
    const entry: TrashEntry = { type: 'people', item: person('p1', 'Ann', '') };
    expect(getLinkedEntries(entry, [entry])).toEqual([entry]);
  });
});

describe('filterEntries', () => {
  const entries: TrashEntry[] = [
    { type: 'people', item: { ...person('p1', 'José', ''), surname: 'Núñez' } },
    { type: 'people', item: person('p2', 'Anna', '') },
    { type: 'relationships', item: relationship('r1', 'Anna', 'Piotr') },
  ];

  it('ignores case and accents and requires every word', () => {
    expect(filterEntries(entries, 'jose nunez').map(entryKey)).toEqual(['people:p1']);
    expect(filterEntries(entries, 'ANNA').map(entryKey)).toEqual(['people:p2', 'relationships:r1']);
    expect(filterEntries(entries, 'anna piotr').map(entryKey)).toEqual(['relationships:r1']);
  });

  it('returns everything for a blank query', () => {
    expect(filterEntries(entries, '   ')).toHaveLength(3);
  });
});

describe('mergeEntries', () => {
  it('puts the most recently deleted first across types', () => {
    const byType = emptyItemsByType();
    byType.people = [person('p1', 'Old', '2026-03-01T00:00:00.000Z')];
    byType.groups = [{ id: 'g1', name: 'New', description: null, color: null, deletedAt: '2026-03-20T00:00:00.000Z' }];
    expect(mergeEntries(byType).map(entryKey)).toEqual(['groups:g1', 'people:p1']);
  });
});
