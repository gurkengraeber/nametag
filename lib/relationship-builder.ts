/**
 * Pure logic for the relationship builder page (/people/connect): which pairs
 * are connected, how the "recently used" relationship types are ordered, and
 * the geometry used while dragging a card. No React and no browser globals
 * except where noted, so every rule here is unit-testable.
 */
import { storageKey } from '@/lib/client-storage';

/** A person as the builder shows them. Names are formatted on the server. */
export interface BuilderPerson {
  id: string;
  displayName: string;
  /** Display name override, shown as a quieter second line when set. */
  secondary: string | null;
  nickname: string | null;
  photo: string | null;
  /** Label of the relationship to the signed-in user, e.g. "Friend". */
  relationshipLabel: string | null;
  groupIds: string[];
}

export interface BuilderType {
  id: string;
  name: string;
  label: string;
  color: string | null;
  inverseId: string | null;
}

/** One stored direction of a relationship: personId is relatedPersonId's type. */
export interface BuilderLink {
  id: string;
  personId: string;
  relatedPersonId: string;
  relationshipTypeId: string;
}

/** Pointer travel (px) before a mouse press counts as a drag, not a click. */
export const DRAG_THRESHOLD_PX = 6;
/** Touch: how long a finger must rest on a card before it starts a drag. */
export const LONG_PRESS_MS = 250;
/** Touch: moving further than this before the long press fires means "scroll". */
export const LONG_PRESS_TOLERANCE_PX = 10;
/** Distance from the viewport edge where dragging starts to auto-scroll. */
export const AUTO_SCROLL_EDGE_PX = 72;
export const AUTO_SCROLL_MAX_SPEED = 18;
/** How many types are remembered, and how many links the "just linked" list holds. */
export const MAX_RECENT_TYPES = 12;
export const MAX_RECENT_LINKS = 10;

/** Directed key: "a is related to b". */
export function pairKey(a: string, b: string): string {
  return `${a}>${b}`;
}

/** Order-independent key for the pair {a, b}. */
export function unorderedPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Type ids already stored in the direction a -> b ("a is b's ..."). */
export function typeIdsBetween(links: BuilderLink[], a: string, b: string): string[] {
  const ids: string[] = [];
  for (const link of links) {
    if (link.personId === a && link.relatedPersonId === b) ids.push(link.relationshipTypeId);
  }
  return ids;
}

/** True when any relationship exists between the two people, in either direction. */
export function isPairConnected(links: BuilderLink[], a: string, b: string): boolean {
  return links.some(
    (link) =>
      (link.personId === a && link.relatedPersonId === b) ||
      (link.personId === b && link.relatedPersonId === a)
  );
}

/**
 * Whether a relationship we are about to create can be undone cleanly. The
 * DELETE route also removes "the" reverse row of the pair without looking at
 * its type, so it may only be used when no reverse row existed before.
 */
export function canUndoCleanly(links: BuilderLink[], a: string, b: string): boolean {
  return !links.some((link) => link.personId === b && link.relatedPersonId === a);
}

/** Number of distinct people each person is connected to. */
export function countConnections(links: BuilderLink[]): Map<string, number> {
  const neighbours = new Map<string, Set<string>>();
  const add = (from: string, to: string) => {
    const set = neighbours.get(from);
    if (set) set.add(to);
    else neighbours.set(from, new Set([to]));
  };
  for (const link of links) {
    add(link.personId, link.relatedPersonId);
    add(link.relatedPersonId, link.personId);
  }
  const counts = new Map<string, number>();
  neighbours.forEach((set, id) => counts.set(id, set.size));
  return counts;
}

/** The type a reverse row gets: the inverse if there is one, else the type itself. */
export function inverseTypeIdOf(type: BuilderType): string {
  return type.inverseId ?? type.id;
}

function hasLink(links: BuilderLink[], a: string, b: string, typeId: string): boolean {
  return links.some(
    (link) => link.personId === a && link.relatedPersonId === b && link.relationshipTypeId === typeId
  );
}

/** Local state after the API created "a is b's <type>" plus its reverse row. */
export function applyCreated(
  links: BuilderLink[],
  created: { id: string; a: string; b: string; typeId: string; inverseTypeId: string }
): BuilderLink[] {
  const next = [...links];
  if (!hasLink(next, created.a, created.b, created.typeId)) {
    next.push({
      id: created.id,
      personId: created.a,
      relatedPersonId: created.b,
      relationshipTypeId: created.typeId,
    });
  }
  if (!hasLink(next, created.b, created.a, created.inverseTypeId)) {
    // The API does not return the reverse row's id; only the pair matters here.
    next.push({
      id: `local:${created.id}`,
      personId: created.b,
      relatedPersonId: created.a,
      relationshipTypeId: created.inverseTypeId,
    });
  }
  return next;
}

/** Local state after the primary row (and with it the reverse row) was deleted. */
export function applyUndone(
  links: BuilderLink[],
  undone: { id: string; a: string; b: string; typeId: string; inverseTypeId: string }
): BuilderLink[] {
  return links.filter(
    (link) =>
      link.id !== undone.id &&
      link.id !== `local:${undone.id}` &&
      !(
        link.personId === undone.b &&
        link.relatedPersonId === undone.a &&
        link.relationshipTypeId === undone.inverseTypeId
      )
  );
}

/** Recently used types first (most recent first), then the rest by label. */
export function sortTypesByRecent(types: BuilderType[], recentIds: string[]): BuilderType[] {
  const byId = new Map(types.map((type) => [type.id, type]));
  const recent: BuilderType[] = [];
  const seen = new Set<string>();
  for (const id of recentIds) {
    const type = byId.get(id);
    if (type && !seen.has(id)) {
      recent.push(type);
      seen.add(id);
    }
  }
  const rest = types
    .filter((type) => !seen.has(type.id))
    .sort((x, y) => x.label.localeCompare(y.label));
  return [...recent, ...rest];
}

/** Put `id` first, drop duplicates, cap the list. */
export function rememberType(recentIds: string[], id: string, max = MAX_RECENT_TYPES): string[] {
  return [id, ...recentIds.filter((existing) => existing !== id)].slice(0, max);
}

/** Reads the stored JSON defensively: anything that is not a string array is ignored. */
export function parseRecentTypeIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_TYPES);
  } catch {
    return [];
  }
}

const RECENT_TYPES_AREA = 'connect-recent-types';

export function readRecentTypeIds(userId: string): string[] {
  try {
    return parseRecentTypeIds(window.localStorage.getItem(storageKey(RECENT_TYPES_AREA, userId)));
  } catch {
    return [];
  }
}

export function writeRecentTypeIds(userId: string, ids: string[]): void {
  try {
    window.localStorage.setItem(storageKey(RECENT_TYPES_AREA, userId), JSON.stringify(ids));
  } catch {
    // Blocked or full storage only costs the remembered order.
  }
}

/** True once the pointer travelled far enough from where it went down. */
export function exceedsDragThreshold(
  dx: number,
  dy: number,
  threshold: number = DRAG_THRESHOLD_PX
): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

/** The person id of the card at or around `element`, or null. */
export function findPersonIdAt(element: Element | null): string | null {
  const card = element?.closest('[data-person-id]');
  return card?.getAttribute('data-person-id') ?? null;
}

/** The card element itself, for anchoring the picker. */
export function findCardAt(element: Element | null): HTMLElement | null {
  const card = element?.closest('[data-person-id]');
  return card instanceof HTMLElement ? card : null;
}

/** Scroll step for the pointer position: negative up, positive down, 0 in the middle. */
export function autoScrollDelta(
  clientY: number,
  viewportHeight: number,
  edge: number = AUTO_SCROLL_EDGE_PX,
  maxSpeed: number = AUTO_SCROLL_MAX_SPEED
): number {
  if (clientY < edge) {
    const strength = Math.min(1, (edge - Math.max(clientY, 0)) / edge);
    return -Math.max(1, Math.round(strength * maxSpeed));
  }
  if (clientY > viewportHeight - edge) {
    const strength = Math.min(1, (clientY - (viewportHeight - edge)) / edge);
    return Math.max(1, Math.round(strength * maxSpeed));
  }
  return 0;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Name search (display name, nickname, override) plus an optional group filter. */
export function filterPeople(
  people: BuilderPerson[],
  filter: { query: string; groupId: string }
): BuilderPerson[] {
  const needle = normalize(filter.query.trim());
  return people.filter((person) => {
    if (filter.groupId && !person.groupIds.includes(filter.groupId)) return false;
    if (!needle) return true;
    const haystack = normalize(
      [person.displayName, person.nickname, person.secondary].filter(Boolean).join(' ')
    );
    return haystack.includes(needle);
  });
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where to put the type picker next to the card it belongs to: below it when
 * there is room, else above (anchored by its bottom edge, so a short panel
 * hugs the card), else centred in the viewport. Always clamped to the
 * viewport with a small margin.
 */
export function computePopoverPosition(
  anchor: Rect,
  viewport: { width: number; height: number },
  size: { width: number; height: number },
  margin = 8
): { left: number; top?: number; bottom?: number } {
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const left = Math.min(Math.max(anchor.left, margin), maxLeft);

  const below = anchor.bottom + margin;
  if (below + size.height <= viewport.height - margin) return { left, top: below };

  const above = anchor.top - margin - size.height;
  if (above >= margin) return { left, bottom: viewport.height - anchor.top + margin };

  return { left, top: Math.max(margin, (viewport.height - size.height) / 2) };
}
