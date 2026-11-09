import type { RawGraphPerson } from './bubble-composition';
import type { SimulationEdge } from './simulation-types';

export interface LegendGroup {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface LegendRelationship {
  label: string;
  color: string;
  count: number;
}

export interface GraphLegendData {
  groups: LegendGroup[];
  relationships: LegendRelationship[];
  /** Number of people without a group (drawn in the neutral color). */
  ungroupedCount: number;
}

export const LEGEND_MAX_RELATIONSHIPS = 8;

/**
 * What the colors in the graph mean. A person is colored by their first group,
 * an edge by its relationship type, so the legend counts exactly those.
 */
export function buildGraphLegend(
  people: readonly RawGraphPerson[],
  edges: readonly SimulationEdge[],
  groups: ReadonlyArray<{ id: string; name: string }>,
  maxRelationships: number = LEGEND_MAX_RELATIONSHIPS,
): GraphLegendData {
  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  const groupCounts = new Map<string, LegendGroup>();
  let ungroupedCount = 0;

  for (const person of people) {
    if (person.isCenter) continue;
    const primary = person.groups[0];
    const name = primary ? groupNames.get(primary) : undefined;
    if (!primary || !name) {
      ungroupedCount += 1;
      continue;
    }
    const entry = groupCounts.get(primary);
    if (entry) entry.count += 1;
    else groupCounts.set(primary, { id: primary, name, color: person.colors[0], count: 1 });
  }

  const relationshipCounts = new Map<string, LegendRelationship>();
  for (const edge of edges) {
    if (edge.type === 'aggregated' || edge.type === 'membership') continue;
    const key = edge.type.toLowerCase();
    const entry = relationshipCounts.get(key);
    if (entry) entry.count += 1;
    else relationshipCounts.set(key, { label: edge.type, color: edge.color, count: 1 });
  }

  return {
    groups: [...groupCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    relationships: [...relationshipCounts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, maxRelationships),
    ungroupedCount,
  };
}
