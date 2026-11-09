/**
 * Toggles a group of ids in a selection. If every id is already selected they
 * are all removed, otherwise they are all added. This is what tapping a marker
 * that stands for several people (a shared address) should do.
 */
export function toggleIds(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(selected);
  if (ids.length === 0) return next;
  const allSelected = ids.every((id) => next.has(id));
  for (const id of ids) {
    if (allSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}

/** Adds ids to a selection without ever removing anything (frame selection, select all shown). */
export function addIds(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(selected);
  for (const id of ids) next.add(id);
  return next;
}

export interface ScreenPoint {
  personId: string;
  x: number;
  y: number;
}

export interface ScreenRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Frames smaller than this many pixels in both directions count as a tap, not a frame. */
export const MIN_FRAME_SIZE = 8;

export function isFrameBigEnough(rect: ScreenRect): boolean {
  return Math.abs(rect.x2 - rect.x1) >= MIN_FRAME_SIZE || Math.abs(rect.y2 - rect.y1) >= MIN_FRAME_SIZE;
}

/**
 * Person ids whose projected position lies inside a dragged frame. Works in
 * screen space so it stays correct when the map is rotated or tilted.
 */
export function personIdsInRect(points: readonly ScreenPoint[], rect: ScreenRect): string[] {
  const left = Math.min(rect.x1, rect.x2);
  const right = Math.max(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const bottom = Math.max(rect.y1, rect.y2);
  const ids = new Set<string>();
  for (const point of points) {
    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
      ids.add(point.personId);
    }
  }
  return [...ids];
}
