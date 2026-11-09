/**
 * "3 minutes ago" style text for the sync status. Takes `now` as an argument
 * so it can be tested and so server and browser render the same first frame.
 */
export function formatRelativeTime(
  date: Date | string | number,
  now: Date | number,
  locale: string,
): string {
  const target = new Date(date).getTime();
  const current = typeof now === 'number' ? now : now.getTime();
  const diffSeconds = Math.round((target - current) / 1000);
  const abs = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (abs < 45) return formatter.format(0, 'second');
  if (abs < 45 * 60) return formatter.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 22 * 3600) return formatter.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 26 * 86400) return formatter.format(Math.round(diffSeconds / 86400), 'day');
  if (abs < 320 * 86400) return formatter.format(Math.round(diffSeconds / (30 * 86400)), 'month');
  return formatter.format(Math.round(diffSeconds / (365 * 86400)), 'year');
}
