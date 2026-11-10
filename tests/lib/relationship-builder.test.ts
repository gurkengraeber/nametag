import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DRAG_THRESHOLD_PX,
  applyCreated,
  applyUndone,
  autoScrollDelta,
  canUndoCleanly,
  computePopoverPosition,
  countConnections,
  exceedsDragThreshold,
  filterPeople,
  findPersonIdAt,
  inverseTypeIdOf,
  parseRecentTypeIds,
  readRecentTypeIds,
  rememberType,
  sortTypesByRecent,
  typeIdsBetween,
  writeRecentTypeIds,
  type BuilderLink,
  type BuilderPerson,
  type BuilderType,
} from '@/lib/relationship-builder';

const type = (id: string, label: string, inverseId: string | null = null): BuilderType => ({
  id,
  name: label.toUpperCase(),
  label,
  color: null,
  inverseId,
});

const link = (id: string, personId: string, relatedPersonId: string, relationshipTypeId: string): BuilderLink => ({
  id,
  personId,
  relatedPersonId,
  relationshipTypeId,
});

const person = (id: string, displayName: string, extra: Partial<BuilderPerson> = {}): BuilderPerson => ({
  id,
  displayName,
  secondary: null,
  nickname: null,
  photo: null,
  relationshipLabel: null,
  groupIds: [],
  ...extra,
});

describe('existing links between a pair', () => {
  const links = [link('1', 'a', 'b', 'parent'), link('2', 'b', 'a', 'child'), link('3', 'a', 'c', 'friend')];

  it('lists only the types stored in the asked direction', () => {
    expect(typeIdsBetween(links, 'a', 'b')).toEqual(['parent']);
    expect(typeIdsBetween(links, 'b', 'a')).toEqual(['child']);
    expect(typeIdsBetween(links, 'c', 'a')).toEqual([]);
  });

  it('allows a clean undo only when the reverse direction is empty', () => {
    expect(canUndoCleanly(links, 'b', 'c')).toBe(true);
    expect(canUndoCleanly(links, 'a', 'c')).toBe(true);
    expect(canUndoCleanly(links, 'a', 'b')).toBe(false);
    expect(canUndoCleanly(links, 'c', 'a')).toBe(false);
  });
});

describe('countConnections', () => {
  it('counts distinct neighbours, not rows', () => {
    const counts = countConnections([
      link('1', 'a', 'b', 'parent'),
      link('2', 'b', 'a', 'child'),
      link('3', 'a', 'c', 'friend'),
      link('4', 'a', 'b', 'friend'),
    ]);
    expect(counts.get('a')).toBe(2);
    expect(counts.get('b')).toBe(1);
    expect(counts.get('c')).toBe(1);
    expect(counts.get('nobody')).toBeUndefined();
  });
});

describe('applyCreated and applyUndone', () => {
  it('adds both directions with the inverse type', () => {
    const next = applyCreated([], { id: 'r1', a: 'a', b: 'b', typeId: 'parent', inverseTypeId: 'child' });
    expect(typeIdsBetween(next, 'a', 'b')).toEqual(['parent']);
    expect(typeIdsBetween(next, 'b', 'a')).toEqual(['child']);
  });

  it('does not duplicate a reverse row that already existed', () => {
    const start = [link('x', 'b', 'a', 'child')];
    const next = applyCreated(start, { id: 'r1', a: 'a', b: 'b', typeId: 'parent', inverseTypeId: 'child' });
    expect(next).toHaveLength(2);
  });

  it('removes the created pair again', () => {
    const created = { id: 'r1', a: 'a', b: 'b', typeId: 'parent', inverseTypeId: 'child' };
    const start = [link('z', 'a', 'c', 'friend')];
    const next = applyUndone(applyCreated(start, created), created);
    expect(next).toEqual(start);
  });

  it('works for symmetric types', () => {
    const created = { id: 'r1', a: 'a', b: 'b', typeId: 'friend', inverseTypeId: 'friend' };
    const next = applyCreated([], created);
    expect(typeIdsBetween(next, 'b', 'a')).toEqual(['friend']);
    expect(applyUndone(next, created)).toEqual([]);
  });
});

describe('inverseTypeIdOf', () => {
  it('uses the inverse, or the type itself for symmetric types', () => {
    expect(inverseTypeIdOf(type('parent', 'Parent', 'child'))).toBe('child');
    expect(inverseTypeIdOf(type('friend', 'Friend'))).toBe('friend');
  });
});

describe('recently used types', () => {
  const types = [type('c', 'Colleague'), type('a', 'Acquaintance'), type('f', 'Friend'), type('p', 'Parent')];

  it('puts recent types first, in recent order, then the rest by label', () => {
    expect(sortTypesByRecent(types, ['p', 'c']).map((x) => x.id)).toEqual(['p', 'c', 'a', 'f']);
  });

  it('ignores unknown and repeated ids', () => {
    expect(sortTypesByRecent(types, ['gone', 'f', 'f']).map((x) => x.id)).toEqual(['f', 'a', 'c', 'p']);
  });

  it('moves a used type to the front without duplicates and caps the list', () => {
    expect(rememberType(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
    expect(rememberType(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });

  it('parses stored values defensively', () => {
    expect(parseRecentTypeIds(null)).toEqual([]);
    expect(parseRecentTypeIds('not json')).toEqual([]);
    expect(parseRecentTypeIds('{"a":1}')).toEqual([]);
    expect(parseRecentTypeIds('["a", 3, "b"]')).toEqual(['a', 'b']);
  });
});

describe('recent types in localStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips per user', () => {
    writeRecentTypeIds('u1', ['a', 'b']);
    expect(readRecentTypeIds('u1')).toEqual(['a', 'b']);
    expect(readRecentTypeIds('u2')).toEqual([]);
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readRecentTypeIds('u1')).toEqual([]);
    expect(() => writeRecentTypeIds('u1', ['a'])).not.toThrow();
  });
});

describe('drag geometry', () => {
  it('treats small movement as a click and larger movement as a drag', () => {
    expect(exceedsDragThreshold(2, 3)).toBe(false);
    expect(exceedsDragThreshold(DRAG_THRESHOLD_PX, 0)).toBe(true);
    expect(exceedsDragThreshold(4, 5)).toBe(true);
    expect(exceedsDragThreshold(0, 0, 1)).toBe(false);
  });

  it('finds the person id of the card around an element', () => {
    document.body.innerHTML = '<button data-person-id="p1"><span id="inner">x</span></button><div id="none"></div>';
    expect(findPersonIdAt(document.getElementById('inner'))).toBe('p1');
    expect(findPersonIdAt(document.getElementById('none'))).toBeNull();
    expect(findPersonIdAt(null)).toBeNull();
  });

  it('scrolls only near the viewport edges and faster the closer to the edge', () => {
    expect(autoScrollDelta(400, 800)).toBe(0);
    expect(autoScrollDelta(10, 800)).toBeLessThan(0);
    expect(autoScrollDelta(790, 800)).toBeGreaterThan(0);
    expect(Math.abs(autoScrollDelta(2, 800))).toBeGreaterThan(Math.abs(autoScrollDelta(60, 800)));
    expect(autoScrollDelta(-20, 800)).toBeLessThan(0);
  });
});

describe('filterPeople', () => {
  const people = [
    person('1', 'Anna Schmidt', { groupIds: ['family'] }),
    person('2', 'Ben Müller', { nickname: 'Benno', groupIds: ['work'] }),
    person('3', 'Chloé Dupont', { secondary: 'Coco' }),
  ];

  it('returns everyone for an empty filter', () => {
    expect(filterPeople(people, { query: '', groupId: '' })).toHaveLength(3);
  });

  it('matches names, nicknames and overrides, ignoring case and accents', () => {
    expect(filterPeople(people, { query: 'ANNA', groupId: '' }).map((p) => p.id)).toEqual(['1']);
    expect(filterPeople(people, { query: 'muller', groupId: '' }).map((p) => p.id)).toEqual(['2']);
    expect(filterPeople(people, { query: 'benno', groupId: '' }).map((p) => p.id)).toEqual(['2']);
    expect(filterPeople(people, { query: 'coco', groupId: '' }).map((p) => p.id)).toEqual(['3']);
    expect(filterPeople(people, { query: 'chloe', groupId: '' }).map((p) => p.id)).toEqual(['3']);
  });

  it('combines the group filter with the search', () => {
    expect(filterPeople(people, { query: '', groupId: 'work' }).map((p) => p.id)).toEqual(['2']);
    expect(filterPeople(people, { query: 'anna', groupId: 'work' })).toEqual([]);
  });
});

describe('computePopoverPosition', () => {
  const viewport = { width: 1000, height: 800 };
  const size = { width: 360, height: 400 };

  it('opens below the card when there is room', () => {
    const pos = computePopoverPosition({ left: 100, top: 100, right: 300, bottom: 160 }, viewport, size);
    expect(pos).toEqual({ left: 100, top: 168 });
  });

  it('opens above, hugging the card, when there is no room below', () => {
    const pos = computePopoverPosition({ left: 100, top: 600, right: 300, bottom: 660 }, viewport, size);
    expect(pos).toEqual({ left: 100, bottom: 800 - 600 + 8 });
  });

  it('is centred when it fits neither above nor below', () => {
    const pos = computePopoverPosition(
      { left: 100, top: 300, right: 300, bottom: 360 },
      { width: 1000, height: 500 },
      { width: 360, height: 480 }
    );
    expect(pos.top).toBe(10);
  });

  it('keeps the panel inside the viewport horizontally', () => {
    const right = computePopoverPosition({ left: 900, top: 100, right: 990, bottom: 160 }, viewport, size);
    expect(right.left).toBe(1000 - 360 - 8);
    const left = computePopoverPosition({ left: -50, top: 100, right: 50, bottom: 160 }, viewport, size);
    expect(left.left).toBe(8);
  });
});
