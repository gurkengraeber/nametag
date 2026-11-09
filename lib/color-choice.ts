import { PRESET_COLORS } from './colors';

/**
 * Picks the first suggested color nobody else uses yet, so a new group or
 * relationship type starts out distinguishable. When every suggestion is
 * taken it cycles through them. Deterministic, which also keeps server and
 * client rendering identical.
 */
export function pickFreshColor(
  takenColors: readonly (string | null | undefined)[],
  palette: readonly string[] = PRESET_COLORS
): string {
  const taken = new Set(
    takenColors.filter((c): c is string => !!c).map((c) => c.toLowerCase())
  );
  const fresh = palette.find((c) => !taken.has(c.toLowerCase()));
  if (fresh) return fresh;
  return palette[taken.size % palette.length];
}
