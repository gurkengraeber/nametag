import { normalizeNameForComparison } from './name-similarity';

/** Case, accent and punctuation insensitive filter on a display label. */
export function filterByLabel<T extends { label: string }>(items: readonly T[], query: string): T[] {
  const needle = normalizeNameForComparison(query);
  if (needle.length === 0) return [...items];
  return items.filter((item) => normalizeNameForComparison(item.label).includes(needle));
}

/** Returns a new set with the id added when missing, removed when present. */
export function toggleSelected(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Ticks or unticks all given ids, leaving other selected ids untouched. */
export function setAllSelected(
  selected: ReadonlySet<string>,
  ids: readonly string[],
  checked: boolean
): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return next;
}

export type SelectionState = 'none' | 'some' | 'all';

/** Whether none, some or all of the given ids are selected (for a select-all box). */
export function selectionState(selected: ReadonlySet<string>, ids: readonly string[]): SelectionState {
  if (ids.length === 0) return 'none';
  const count = ids.filter((id) => selected.has(id)).length;
  if (count === 0) return 'none';
  return count === ids.length ? 'all' : 'some';
}
