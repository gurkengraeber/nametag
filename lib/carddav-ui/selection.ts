import { normalizeForSearch } from '@/lib/search';

/**
 * Pure helpers for the CardDAV import and export lists: searching, selecting
 * only what is currently visible, and cutting a long request into batches so
 * the page can show real progress.
 */

/**
 * True when every whitespace separated word of the query appears somewhere in
 * the given parts. Accent and case insensitive, so "jose" finds "José Pérez".
 * An empty query matches everything.
 */
export function matchesAllWords(
  parts: ReadonlyArray<string | null | undefined>,
  query: string,
): boolean {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeForSearch(parts.filter(Boolean).join(' '));
  return words.every((word) => haystack.includes(word));
}

export function filterBySearch<T>(
  items: readonly T[],
  query: string,
  getParts: (item: T) => ReadonlyArray<string | null | undefined>,
): T[] {
  if (!query.trim()) return [...items];
  return items.filter((item) => matchesAllWords(getParts(item), query));
}

export function areAllSelected(
  selected: ReadonlySet<string>,
  ids: readonly string[],
): boolean {
  return ids.length > 0 && ids.every((id) => selected.has(id));
}

/**
 * Select all visible ids, or deselect them when they are all selected already.
 * Ids that are not visible (hidden by a filter) are never touched, so
 * "select all" with a search active cannot silently pick up other contacts.
 */
export function toggleVisible(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
): Set<string> {
  const next = new Set(selected);
  if (areAllSelected(selected, visibleIds)) {
    for (const id of visibleIds) next.delete(id);
  } else {
    for (const id of visibleIds) next.add(id);
  }
  return next;
}

export function toggleOne(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Drop selected ids that are no longer part of the given list. */
export function pruneSelection(
  selected: ReadonlySet<string>,
  validIds: readonly string[],
): Set<string> {
  const valid = new Set(validIds);
  return new Set([...selected].filter((id) => valid.has(id)));
}

export interface SelectionStats {
  total: number;
  visibleSelected: number;
  hiddenSelected: number;
}

export function selectionStats(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
): SelectionStats {
  const visible = new Set(visibleIds);
  let visibleSelected = 0;
  for (const id of selected) if (visible.has(id)) visibleSelected++;
  return {
    total: selected.size,
    visibleSelected,
    hiddenSelected: selected.size - visibleSelected,
  };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be at least 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface BatchRun<R> {
  results: R[];
  /** Number of items that were sent before the run ended. */
  processed: number;
  /** Set when a batch threw; the remaining batches were not sent. */
  error: unknown;
}

/**
 * Run a request per batch, one after the other, reporting how many items are
 * done so far. Stops at the first batch that throws and keeps what the earlier
 * batches returned, so the caller can still show a partial summary.
 */
export async function runInBatches<T, R>(
  items: readonly T[],
  size: number,
  run: (batch: T[]) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<BatchRun<R>> {
  const results: R[] = [];
  let processed = 0;
  onProgress?.(0, items.length);
  for (const batch of chunk(items, size)) {
    try {
      results.push(await run(batch));
    } catch (error) {
      return { results, processed, error };
    }
    processed += batch.length;
    onProgress?.(processed, items.length);
  }
  return { results, processed, error: null };
}
