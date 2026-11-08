import { describe, it, expect } from 'vitest';
import {
  buildPeopleWhere,
  parseCustomFieldFilter,
  formatCustomFieldFilter,
} from '../../lib/people-filter';

describe('parseCustomFieldFilter', () => {
  it('splits slug and value at the first colon', () => {
    expect(parseCustomFieldFilter('pet:Dog')).toEqual({ slug: 'pet', value: 'Dog' });
    expect(parseCustomFieldFilter('time:10:30')).toEqual({ slug: 'time', value: '10:30' });
  });

  it('returns null when there is no usable filter', () => {
    expect(parseCustomFieldFilter(undefined)).toBeNull();
    expect(parseCustomFieldFilter('')).toBeNull();
    expect(parseCustomFieldFilter('nocolon')).toBeNull();
    expect(parseCustomFieldFilter(':value')).toBeNull();
  });

  it('is undone by formatCustomFieldFilter', () => {
    expect(formatCustomFieldFilter(parseCustomFieldFilter('time:10:30'))).toBe('time:10:30');
    expect(formatCustomFieldFilter(null)).toBeUndefined();
  });
});

describe('buildPeopleWhere', () => {
  it('selects all active people of the user without a filter', () => {
    expect(buildPeopleWhere('u1')).toEqual({ userId: 'u1', deletedAt: null });
    expect(buildPeopleWhere('u1', {})).toEqual({ userId: 'u1', deletedAt: null });
  });

  it('ignores empty filter values', () => {
    expect(buildPeopleWhere('u1', { group: '', relationship: '', cf: '' })).toEqual({
      userId: 'u1',
      deletedAt: null,
    });
  });

  it('filters by group and by no group', () => {
    expect(buildPeopleWhere('u1', { group: 'g1' }).groups).toEqual({ some: { groupId: 'g1' } });
    expect(buildPeopleWhere('u1', { group: 'none' }).groups).toEqual({ none: {} });
  });

  it('filters by relationship type and by no relationship', () => {
    expect(buildPeopleWhere('u1', { relationship: 'rt1' }).relationshipToUserId).toBe('rt1');
    expect(buildPeopleWhere('u1', { relationship: 'none' }).relationshipToUserId).toBeNull();
  });

  it('filters by a custom field value of the same user, ignoring case', () => {
    expect(buildPeopleWhere('u1', { cf: 'pet:Dog' }).customFieldValues).toEqual({
      some: {
        value: { equals: 'Dog', mode: 'insensitive' },
        template: { slug: 'pet', userId: 'u1', deletedAt: null },
      },
    });
  });

  it('combines all filters', () => {
    const where = buildPeopleWhere('u1', { group: 'g1', relationship: 'rt1', cf: 'pet:Dog' });

    expect(where).toMatchObject({
      userId: 'u1',
      deletedAt: null,
      groups: { some: { groupId: 'g1' } },
      relationshipToUserId: 'rt1',
    });
    expect(where.customFieldValues).toBeDefined();
  });
});
