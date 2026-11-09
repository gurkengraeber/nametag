import type { RawGraphPerson } from './bubble-composition';

export const SEARCH_MAX_RESULTS = 6;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Find people in the graph by name. Accents and case are ignored. Names that
 * start with the query come first, then names with a word that starts with it,
 * then names that contain it anywhere. The center node ("you") is never a hit.
 */
export function searchGraphPeople(
  people: readonly RawGraphPerson[],
  query: string,
  limit: number = SEARCH_MAX_RESULTS,
): RawGraphPerson[] {
  const needle = normalize(query);
  if (!needle) return [];

  const ranked: Array<{ person: RawGraphPerson; rank: number }> = [];
  for (const person of people) {
    if (person.isCenter) continue;
    const label = normalize(person.label);
    let rank: number;
    if (label.startsWith(needle)) rank = 0;
    else if (label.split(/\s+/).some((word) => word.startsWith(needle))) rank = 1;
    else if (label.includes(needle)) rank = 2;
    else continue;
    ranked.push({ person, rank });
  }

  ranked.sort((a, b) => a.rank - b.rank || a.person.label.localeCompare(b.person.label));
  return ranked.slice(0, limit).map((entry) => entry.person);
}
