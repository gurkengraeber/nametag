import { prisma as prismaClient } from './prisma';
import { sanitizeLabel } from './sanitize';

// Type that accepts the extended prisma client
type PrismaClientLike = typeof prismaClient;

/**
 * Pre-loaded relationship types that are created for every new user.
 * Each user gets their own copy of these types that they can modify or delete.
 */
export const PRELOADED_RELATIONSHIP_TYPES = [
  { name: 'PARENT', label: 'Parent', color: '#F59E0B', inverseName: 'CHILD' },
  { name: 'CHILD', label: 'Child', color: '#F59E0B', inverseName: 'PARENT' },
  { name: 'SIBLING', label: 'Sibling', color: '#8B5CF6', symmetric: true },
  { name: 'SPOUSE', label: 'Spouse', color: '#EC4899', symmetric: true },
  { name: 'PARTNER', label: 'Partner', color: '#EC4899', symmetric: true },
  { name: 'FRIEND', label: 'Friend', color: '#3B82F6', symmetric: true },
  { name: 'COLLEAGUE', label: 'Colleague', color: '#10B981', symmetric: true },
  { name: 'ACQUAINTANCE', label: 'Acquaintance', color: '#14B8A6', symmetric: true },
  { name: 'RELATIVE', label: 'Relative', color: '#6366F1', symmetric: true },
  { name: 'OTHER', label: 'Other', color: '#6B7280', symmetric: true },
] as const;

/**
 * Creates the pre-loaded relationship types for a user.
 * This should be called when a new user is created.
 */
export async function createPreloadedRelationshipTypes(
  prisma: PrismaClientLike,
  userId: string
): Promise<void> {
  // Create a map to store created type IDs
  const typeIdMap = new Map<string, string>();

  // First pass: create all types without inverse relationships
  for (const typeConfig of PRELOADED_RELATIONSHIP_TYPES) {
    const createdType = await prisma.relationshipType.create({
      data: {
        userId,
        name: typeConfig.name,
        label: typeConfig.label,
        color: typeConfig.color,
      },
    });
    typeIdMap.set(typeConfig.name, createdType.id);
  }

  // Second pass: set up inverse relationships
  for (const typeConfig of PRELOADED_RELATIONSHIP_TYPES) {
    const typeId = typeIdMap.get(typeConfig.name);
    if (!typeId) continue;

    let inverseId: string | undefined;

    if ('symmetric' in typeConfig && typeConfig.symmetric) {
      // Symmetric types point to themselves
      inverseId = typeId;
    } else if ('inverseName' in typeConfig && typeConfig.inverseName) {
      // Asymmetric types point to their inverse
      inverseId = typeIdMap.get(typeConfig.inverseName);
    }

    if (inverseId) {
      await prisma.relationshipType.update({
        where: { id: typeId },
        data: { inverseId },
      });
    }
  }
}

/** Internal name of a relationship type, derived from its label. */
export function relationshipTypeNameFromLabel(label: string): string {
  return label.trim().toUpperCase().replace(/\s+/g, '_');
}

export interface CreateMissingTypesResult {
  created: number;
  skipped: number;
}

/**
 * Creates the standard relationship types a user does not have yet, so a
 * user who deleted them all (or never had them) can bring them back with one
 * click. Existing types are never touched, except that a missing counterpart
 * (for example Child when Parent exists) is linked to its partner when the
 * partner has no inverse yet.
 *
 * `labels` optionally maps the standard internal names (FRIEND, PARENT, ...)
 * to display labels in the user's language. The internal name of a created
 * type is derived from its label, like for types created in the form.
 */
export async function createMissingPreloadedRelationshipTypes(
  prisma: PrismaClientLike,
  userId: string,
  labels: Record<string, string> = {}
): Promise<CreateMissingTypesResult> {
  const existing = await prisma.relationshipType.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, name: true, inverseId: true },
  });
  const existingByName = new Map(existing.map((type) => [type.name.toUpperCase(), type]));

  const planned = PRELOADED_RELATIONSHIP_TYPES.map((config) => {
    const label = sanitizeLabel(labels[config.name]?.trim()) || config.label;
    return { config, label, name: relationshipTypeNameFromLabel(label) };
  });

  // Standard key (PARENT, ...) to the id of the type that fills that role.
  const idByKey = new Map<string, string>();
  const inverseIdByKey = new Map<string, string | null>();
  for (const { config, name } of planned) {
    const found = existingByName.get(name);
    if (found) {
      idByKey.set(config.name, found.id);
      inverseIdByKey.set(config.name, found.inverseId);
    }
  }

  const createdKeys: string[] = [];
  const usedNames = new Set(existingByName.keys());
  for (const { config, label, name } of planned) {
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    const created = await prisma.relationshipType.create({
      data: { userId, name, label, color: config.color },
    });
    idByKey.set(config.name, created.id);
    inverseIdByKey.set(config.name, null);
    createdKeys.push(config.name);
  }

  for (const config of PRELOADED_RELATIONSHIP_TYPES) {
    if (!createdKeys.includes(config.name)) continue;
    const typeId = idByKey.get(config.name);
    if (!typeId) continue;

    let partnerKey: string | undefined;
    if ('symmetric' in config && config.symmetric) {
      partnerKey = config.name;
    } else if ('inverseName' in config && config.inverseName) {
      partnerKey = config.inverseName;
    }
    const partnerId = partnerKey ? idByKey.get(partnerKey) : undefined;
    if (!partnerKey || !partnerId) continue;

    await prisma.relationshipType.update({
      where: { id: typeId },
      data: { inverseId: partnerId },
    });
    inverseIdByKey.set(config.name, partnerId);

    // Link an existing partner back only when it has no inverse yet.
    if (partnerKey !== config.name && !createdKeys.includes(partnerKey) && !inverseIdByKey.get(partnerKey)) {
      await prisma.relationshipType.update({
        where: { id: partnerId },
        data: { inverseId: typeId },
      });
      inverseIdByKey.set(partnerKey, typeId);
    }
  }

  return {
    created: createdKeys.length,
    skipped: PRELOADED_RELATIONSHIP_TYPES.length - createdKeys.length,
  };
}
