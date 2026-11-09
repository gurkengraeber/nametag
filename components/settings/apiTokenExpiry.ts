export type TokenExpiryPreset = 'never' | 'days30' | 'days90' | 'year1' | 'custom';

export const TOKEN_EXPIRY_PRESETS: TokenExpiryPreset[] = ['never', 'days30', 'days90', 'year1', 'custom'];

const DAYS: Record<'days30' | 'days90' | 'year1', number> = {
  days30: 30,
  days90: 90,
  year1: 365,
};

/**
 * The expiry to send to the API for a chosen preset, as an ISO string, or null
 * for a token that never expires. A custom preset without a valid date also
 * yields null, so the caller should check `isCustomDateMissing` first.
 */
export function expiryForPreset(
  preset: TokenExpiryPreset,
  customDate: string,
  now: Date = new Date()
): string | null {
  if (preset === 'never') return null;
  if (preset === 'custom') {
    if (!customDate) return null;
    // The chosen day counts as a whole day: the token works until it ends in
    // the viewer's timezone, not until midnight UTC at its start.
    const parsed = new Date(`${customDate}T23:59:59.999`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  // Plain milliseconds, so a daylight saving change cannot shift the result.
  return new Date(now.getTime() + DAYS[preset] * 24 * 60 * 60 * 1000).toISOString();
}

/** True when "pick a date" is chosen but no usable date was entered, or the day is already over. */
export function isCustomDateMissing(
  preset: TokenExpiryPreset,
  customDate: string,
  now: Date = new Date()
): boolean {
  if (preset !== 'custom') return false;
  const expiry = expiryForPreset('custom', customDate);
  return expiry === null || new Date(expiry).getTime() <= now.getTime();
}
