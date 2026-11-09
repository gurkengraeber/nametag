import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '@/lib/carddav-ui/relative-time';

const now = new Date('2026-11-09T12:00:00Z');
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe('formatRelativeTime', () => {
  it('says now for a few seconds', () => {
    expect(formatRelativeTime(ago(10), now, 'en')).toBe('now');
  });

  it('uses minutes, hours, days', () => {
    expect(formatRelativeTime(ago(5 * 60), now, 'en')).toBe('5 minutes ago');
    expect(formatRelativeTime(ago(3 * 3600), now, 'en')).toBe('3 hours ago');
    expect(formatRelativeTime(ago(2 * 86400), now, 'en')).toBe('2 days ago');
  });

  it('uses months and years for old dates', () => {
    expect(formatRelativeTime(ago(90 * 86400), now, 'en')).toBe('3 months ago');
    expect(formatRelativeTime(ago(800 * 86400), now, 'en')).toBe('2 years ago');
  });

  it('follows the locale', () => {
    expect(formatRelativeTime(ago(5 * 60), now, 'de-DE')).toBe('vor 5 Minuten');
  });

  it('accepts ISO strings', () => {
    expect(formatRelativeTime(ago(120).toISOString(), now, 'en')).toBe('2 minutes ago');
  });
});
