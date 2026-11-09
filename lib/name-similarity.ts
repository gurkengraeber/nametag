/**
 * Typo protection for names of groups and relationship types.
 * Pure helpers, no I/O, so they can run in the browser and in tests.
 */

/**
 * Lower-cases, removes accents and drops everything that is not a letter or a
 * digit, so "Best-Friend", "best friend" and "Bést Friend" compare as equal.
 */
export function normalizeNameForComparison(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** Classic Levenshtein edit distance (insert, delete, substitute). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const left = Array.from(a);
  const right = Array.from(b);
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);

  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[right.length];
}

export interface SimilarNameMatch<T> {
  item: T;
  /** True when the names only differ in case, accents, spaces or punctuation. */
  exact: boolean;
}

/** Shortest normalized length for which a one-letter difference counts as similar. */
const MIN_FUZZY_LENGTH = 4;
/** From this normalized length on, two edits are still treated as a typo. */
const LONG_NAME_LENGTH = 9;

/**
 * Finds an existing name that is identical or one typo away from the input.
 * An identical match wins over a near match. Very short names only match
 * when identical, otherwise "Dad" and "Mad" would be flagged.
 */
export function findSimilarName<T>(
  input: string,
  candidates: readonly T[],
  getName: (item: T) => string
): SimilarNameMatch<T> | null {
  const target = normalizeNameForComparison(input);
  if (target.length === 0) return null;

  let nearest: T | null = null;
  let nearestDistance = Infinity;

  for (const item of candidates) {
    const other = normalizeNameForComparison(getName(item));
    if (other.length === 0) continue;
    if (other === target) return { item, exact: true };

    if (target.length < MIN_FUZZY_LENGTH || other.length < MIN_FUZZY_LENGTH) continue;
    const allowed = Math.max(target.length, other.length) >= LONG_NAME_LENGTH ? 2 : 1;
    const distance = editDistance(target, other);
    if (distance <= allowed && distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  }

  return nearest ? { item: nearest, exact: false } : null;
}
