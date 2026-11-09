import type { RawGraphPerson } from './bubble-composition';
import type { SimulationEdge, SimulationNode } from './simulation-types';

export interface LoosePeopleSplit {
  /** The center node and everyone with at least one edge. */
  connected: RawGraphPerson[];
  /** People without any edge, sorted by name. */
  loose: RawGraphPerson[];
}

function endpointId(value: string | SimulationNode): string {
  return typeof value === 'string' ? value : value.id;
}

/**
 * Separate people who have no connection at all (neither to you nor to anyone
 * else) from the rest. Such nodes only feel the repulsion of the others and
 * drift far away from the network, so the dashboard lists them instead of
 * drawing them.
 */
export function splitLoosePeople(
  people: readonly RawGraphPerson[],
  edges: readonly SimulationEdge[],
): LoosePeopleSplit {
  const linked = new Set<string>();
  for (const edge of edges) {
    linked.add(endpointId(edge.source));
    linked.add(endpointId(edge.target));
  }

  const connected: RawGraphPerson[] = [];
  const loose: RawGraphPerson[] = [];
  for (const person of people) {
    if (person.isCenter || linked.has(person.id)) connected.push(person);
    else loose.push(person);
  }
  loose.sort((a, b) => a.label.localeCompare(b.label));
  return { connected, loose };
}
