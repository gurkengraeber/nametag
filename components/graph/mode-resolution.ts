export type GraphMode = 'individuals' | 'bubbles';

/**
 * Networks with more people than this open as group bubbles when the user has
 * not chosen a display mode, because that many individual nodes become a tangle.
 */
export const AUTO_BUBBLE_THRESHOLD = 80;

/**
 * Resolve the active graph mode from the user's saved preference.
 * When unset (null), small networks show individuals and large ones (more than
 * AUTO_BUBBLE_THRESHOLD people, when the size is known) show group bubbles.
 */
export function resolveGraphMode(
  graphMode: GraphMode | null,
  visiblePeopleCount?: number,
): GraphMode {
  if (graphMode) return graphMode;
  if (visiblePeopleCount !== undefined && visiblePeopleCount > AUTO_BUBBLE_THRESHOLD) {
    return 'bubbles';
  }
  return 'individuals';
}
