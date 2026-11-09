/**
 * Pure view logic for the duplicates page: turn the grouped API response into
 * a flat, confidence-sorted list of pairs and describe why they were flagged.
 */

import {
  getDuplicateConfidence,
  type DuplicateConfidence,
  type DuplicateReason,
} from '@/lib/duplicate-detection';

export interface DuplicatePersonDisplay {
  id: string;
  name: string;
  surname: string | null;
}

export interface DuplicatePairDisplay {
  personAId: string;
  personBId: string;
  similarity: number;
  reasons: DuplicateReason[];
}

export interface DuplicateGroupDisplay {
  people: DuplicatePersonDisplay[];
  similarity: number;
  pairs?: DuplicatePairDisplay[];
}

export interface DuplicateSuggestion {
  key: string;
  a: DuplicatePersonDisplay;
  b: DuplicatePersonDisplay;
  similarity: number;
  reasons: DuplicateReason[];
  confidence: DuplicateConfidence;
}

export const CONFIDENCE_ORDER: DuplicateConfidence[] = ['high', 'medium', 'low'];

export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}

/**
 * Flatten groups into one suggestion per flagged pair, most confident first.
 * Groups from older servers carry no pairs; every combination inside such a
 * group is listed with the group's score and no reasons instead.
 */
export function buildSuggestions(groups: DuplicateGroupDisplay[]): DuplicateSuggestion[] {
  const seen = new Set<string>();
  const suggestions: DuplicateSuggestion[] = [];

  for (const group of groups) {
    const byId = new Map(group.people.map((p) => [p.id, p]));
    const pairs: DuplicatePairDisplay[] =
      group.pairs ??
      group.people.flatMap((p, i) =>
        group.people.slice(i + 1).map((q) => ({
          personAId: p.id,
          personBId: q.id,
          similarity: group.similarity,
          reasons: [],
        }))
      );

    for (const pair of pairs) {
      const a = byId.get(pair.personAId);
      const b = byId.get(pair.personBId);
      const key = pairKey(pair.personAId, pair.personBId);
      if (!a || !b || seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        key,
        a,
        b,
        similarity: pair.similarity,
        reasons: pair.reasons,
        confidence: getDuplicateConfidence(pair.similarity, pair.reasons),
      });
    }
  }

  return suggestions.sort((x, y) => y.similarity - x.similarity);
}

/** Drop suggestions that were dismissed or involve a contact that is gone. */
export function filterSuggestions(
  suggestions: DuplicateSuggestion[],
  dismissedKeys: ReadonlySet<string>,
  removedIds: ReadonlySet<string>
): DuplicateSuggestion[] {
  return suggestions.filter(
    (s) => !dismissedKeys.has(s.key) && !removedIds.has(s.a.id) && !removedIds.has(s.b.id)
  );
}

export function groupByConfidence(
  suggestions: DuplicateSuggestion[]
): Array<{ confidence: DuplicateConfidence; items: DuplicateSuggestion[] }> {
  return CONFIDENCE_ORDER.map((confidence) => ({
    confidence,
    items: suggestions.filter((s) => s.confidence === confidence),
  })).filter((section) => section.items.length > 0);
}

/** Number of open suggestions, as shown in hints. */
export function countOpenSuggestions(groups: DuplicateGroupDisplay[]): number {
  return buildSuggestions(groups).length;
}

/** Join reason labels into a readable list ("a, b and c") for the given locale. */
export function formatList(items: string[], locale: string): string {
  if (items.length <= 1) return items.join('');
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}
