import { normalizeNameForComparison } from './name-similarity';

export type GroupSort = 'name' | 'size';

export const GROUP_SORTS: readonly GroupSort[] = ['name', 'size'];

export interface OverviewGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  memberCount: number;
}

export function parseGroupSort(value: string | null | undefined): GroupSort {
  return value === 'size' ? 'size' : 'name';
}

/** Case, accent and punctuation insensitive match on name and description. */
export function filterGroups<T extends Pick<OverviewGroup, 'name' | 'description'>>(
  groups: readonly T[],
  query: string
): T[] {
  const needle = normalizeNameForComparison(query);
  if (needle.length === 0) return [...groups];

  return groups.filter((group) => {
    const haystack = normalizeNameForComparison(`${group.name} ${group.description ?? ''}`);
    return haystack.includes(needle);
  });
}

const compareNames = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

/** 'name' sorts A to Z, 'size' puts the biggest group first and breaks ties by name. */
export function sortGroups<T extends Pick<OverviewGroup, 'name' | 'memberCount'>>(
  groups: readonly T[],
  sort: GroupSort
): T[] {
  return [...groups].sort((a, b) => {
    if (sort === 'size' && a.memberCount !== b.memberCount) {
      return b.memberCount - a.memberCount;
    }
    return compareNames(a.name, b.name);
  });
}

export function visibleGroups<T extends OverviewGroup>(
  groups: readonly T[],
  query: string,
  sort: GroupSort
): T[] {
  return sortGroups(filterGroups(groups, query), sort);
}
