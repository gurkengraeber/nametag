/**
 * Every connection between two people is stored as two rows, one per
 * direction. A type that is its own inverse (or has no inverse) is used by
 * both rows, so the raw row count has to be halved to get the number of
 * connections. A type with a separate inverse is only used by one of the rows.
 */
export function countConnections(
  rowCount: number,
  type: { id: string; inverseId: string | null }
): number {
  const usedByBothDirections = type.inverseId === null || type.inverseId === type.id;
  return usedByBothDirections ? Math.ceil(rowCount / 2) : rowCount;
}

/** Plain-language summary of what deleting a type affects. */
export type RelationshipTypeDeleteImpact = 'blocked' | 'people' | 'unused';

export function getDeleteImpact(peopleCount: number, connectionCount: number): RelationshipTypeDeleteImpact {
  if (connectionCount > 0) return 'blocked';
  if (peopleCount > 0) return 'people';
  return 'unused';
}
