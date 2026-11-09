import { describe, it, expect } from 'vitest';
import { buildGraphLegend } from '../../../components/graph/legend';
import type { RawGraphPerson } from '../../../components/graph/bubble-composition';
import type { SimulationEdge } from '../../../components/graph/simulation-types';

const groups = [
  { id: 'g1', name: 'Family' },
  { id: 'g2', name: 'Work' },
];
const person = (id: string, gs: string[], colors: string[], isCenter = false): RawGraphPerson => ({
  id, label: id, groups: gs, colors, isCenter,
});
const edge = (type: string, color: string): SimulationEdge => ({ source: 'a', target: 'b', type, color });

describe('buildGraphLegend', () => {
  it('counts people by their first group and the rest as ungrouped', () => {
    const people = [
      person('me', [], [], true),
      person('a', ['g2'], ['#00f']),
      person('b', ['g1', 'g2'], ['#f00', '#00f']),
      person('c', ['g1'], ['#f00']),
      person('d', [], []),
      person('e', ['gone'], ['#0f0']),
    ];
    const legend = buildGraphLegend(people, [], groups);
    expect(legend.groups).toEqual([
      { id: 'g1', name: 'Family', color: '#f00', count: 2 },
      { id: 'g2', name: 'Work', color: '#00f', count: 1 },
    ]);
    expect(legend.ungroupedCount).toBe(2);
  });

  it('lists each relationship type once, most used first', () => {
    const edges = [
      edge('Friend', '#0f0'), edge('friend', '#0f0'), edge('Friend', '#0f0'),
      edge('Parent', '#f00'),
      edge('aggregated', '#999'), edge('membership', '#999'),
    ];
    const legend = buildGraphLegend([], edges, groups);
    expect(legend.relationships).toEqual([
      { label: 'Friend', color: '#0f0', count: 3 },
      { label: 'Parent', color: '#f00', count: 1 },
    ]);
  });

  it('caps the number of relationship types', () => {
    const edges = Array.from({ length: 12 }, (_, i) => edge(`Type ${i}`, '#999'));
    expect(buildGraphLegend([], edges, groups, 5).relationships).toHaveLength(5);
  });
});
