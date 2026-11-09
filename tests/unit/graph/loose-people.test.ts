import { describe, it, expect } from 'vitest';
import { splitLoosePeople } from '../../../components/graph/loose-people';
import type { RawGraphPerson } from '../../../components/graph/bubble-composition';
import type { SimulationEdge } from '../../../components/graph/simulation-types';

const person = (id: string, label: string, isCenter = false): RawGraphPerson => ({
  id, label, groups: [], colors: [], isCenter,
});
const edge = (source: string, target: string): SimulationEdge => ({
  source, target, type: 'friend', color: '#999',
});

describe('splitLoosePeople', () => {
  it('keeps you and everyone with an edge, lists the rest sorted by name', () => {
    const people = [
      person('user-1', 'You', true),
      person('a', 'Anna'),
      person('z', 'Zoe'),
      person('m', 'Mia'),
      person('b', 'Ben'),
    ];
    const edges = [edge('a', 'user-1'), edge('user-1', 'a'), edge('b', 'a')];
    const { connected, loose } = splitLoosePeople(people, edges);
    expect(connected.map((p) => p.id)).toEqual(['user-1', 'a', 'b']);
    expect(loose.map((p) => p.label)).toEqual(['Mia', 'Zoe']);
  });

  it('keeps you even without any edge', () => {
    const { connected, loose } = splitLoosePeople([person('user-1', 'You', true)], []);
    expect(connected).toHaveLength(1);
    expect(loose).toHaveLength(0);
  });

  it('understands edges whose ends are already node objects', () => {
    const a = { kind: 'person' as const, ...person('a', 'Anna') };
    const u = { kind: 'person' as const, ...person('user-1', 'You', true) };
    const { loose } = splitLoosePeople(
      [person('user-1', 'You', true), person('a', 'Anna'), person('c', 'Cleo')],
      [{ source: a, target: u, type: 'friend', color: '#999' }],
    );
    expect(loose.map((p) => p.id)).toEqual(['c']);
  });
});
