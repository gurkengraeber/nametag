import { describe, it, expect } from 'vitest';
import {
  describeLastContact,
  matchesLastContactFilter,
  monthsAgoDateString,
} from '../../lib/map/last-contact';

const now = new Date(2026, 10, 9); // 9 November 2026

describe('monthsAgoDateString', () => {
  it('subtracts calendar months', () => {
    expect(monthsAgoDateString(1, now)).toBe('2026-10-09');
    expect(monthsAgoDateString(6, now)).toBe('2026-05-09');
    expect(monthsAgoDateString(12, now)).toBe('2025-11-09');
  });

  it('clamps to the end of a shorter month', () => {
    expect(monthsAgoDateString(1, new Date(2026, 2, 31))).toBe('2026-02-28');
  });
});

describe('matchesLastContactFilter', () => {
  it('passes everyone without a filter or with an unknown value', () => {
    expect(matchesLastContactFilter('2026-11-01', '', now)).toBe(true);
    expect(matchesLastContactFilter(null, 'bogus', now)).toBe(true);
  });

  it('matches people not talked to for longer than the period', () => {
    expect(matchesLastContactFilter('2026-04-01', 'over6m', now)).toBe(true);
    expect(matchesLastContactFilter('2026-05-09', 'over6m', now)).toBe(true);
    expect(matchesLastContactFilter('2026-05-10', 'over6m', now)).toBe(false);
    expect(matchesLastContactFilter('2026-11-08', 'over1m', now)).toBe(false);
  });

  it('counts people without a recorded contact as not talked to', () => {
    expect(matchesLastContactFilter(null, 'over12m', now)).toBe(true);
  });

  it('"never" matches only people without a recorded contact', () => {
    expect(matchesLastContactFilter(null, 'never', now)).toBe(true);
    expect(matchesLastContactFilter('2020-01-01', 'never', now)).toBe(false);
  });
});

describe('describeLastContact', () => {
  it('describes missing and invalid dates as never', () => {
    expect(describeLastContact(null, now)).toEqual({ kind: 'never' });
    expect(describeLastContact('nonsense', now)).toEqual({ kind: 'never' });
  });

  it('describes today, days, months and years', () => {
    expect(describeLastContact('2026-11-09', now)).toEqual({ kind: 'today' });
    expect(describeLastContact('2026-11-08', now)).toEqual({ kind: 'days', count: 1 });
    expect(describeLastContact('2026-10-20', now)).toEqual({ kind: 'days', count: 20 });
    expect(describeLastContact('2026-08-09', now)).toEqual({ kind: 'months', count: 3 });
    expect(describeLastContact('2024-11-09', now)).toEqual({ kind: 'years', count: 2 });
  });

  it('treats a date in the future as today', () => {
    expect(describeLastContact('2026-12-01', now)).toEqual({ kind: 'today' });
  });
});
