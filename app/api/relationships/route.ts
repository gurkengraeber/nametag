import { prisma } from '@/lib/prisma';
import { withDeadlockRetry } from '@/lib/db/deadlock';
import { createRelationshipSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { apiError } from '@/lib/api-errors';

// GET /api/relationships - List all relationships for the current user
export const GET = withAuth(async (_request, session) => {
  try {
    const relationships = await prisma.relationship.findMany({
      where: {
        person: { userId: session.user.id, deletedAt: null },
        relatedPerson: { deletedAt: null },
        OR: [
          { relationshipTypeId: null },
          { relationshipType: { deletedAt: null } },
        ],
      },
      include: {
        person: {
          select: { id: true, name: true, surname: true, nickname: true, displayNameOverride: true },
        },
        relatedPerson: {
          select: { id: true, name: true, surname: true, nickname: true, displayNameOverride: true },
        },
        relationshipType: {
          where: { deletedAt: null },
          select: { id: true, name: true, label: true, color: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiResponse.ok({ relationships });
  } catch (error) {
    return handleApiError(error, 'relationships-list');
  }
});

// POST /api/relationships - Create a new relationship (bidirectional)
export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(createRelationshipSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { personId, relatedPersonId, relationshipTypeId, notes } = validation.data;

    if (!relationshipTypeId) {
      return apiError('relationship_type_required', 'Relationship type is required');
    }

    // Prevent self-relationships
    if (personId === relatedPersonId) {
      return apiError('self_relationship', 'Cannot create a relationship with the same person');
    }

    // Check for duplicate relationship. Scoped to the user, so the answer
    // never says anything about other users' relationships.
    const existingRelationship = await prisma.relationship.findFirst({
      where: {
        personId,
        relatedPersonId,
        relationshipTypeId,
        deletedAt: null,
        person: { userId: session.user.id },
      },
    });

    if (existingRelationship) {
      return apiError('relationship_exists', 'This relationship already exists');
    }

    // Verify both people belong to the user
    const [person, relatedPerson, relationshipType] = await Promise.all([
      prisma.person.findUnique({
        where: { id: personId, userId: session.user.id, deletedAt: null },
      }),
      prisma.person.findUnique({
        where: { id: relatedPersonId, userId: session.user.id, deletedAt: null },
      }),
      prisma.relationshipType.findFirst({
        where: {
          id: relationshipTypeId,
          userId: session.user.id,
          deletedAt: null,
        },
      }),
    ]);

    if (!person || !relatedPerson) {
      return apiResponse.notFound('One or both people not found');
    }

    if (!relationshipType) {
      return apiResponse.notFound('Relationship type not found');
    }

    // Always create the inverse relationship
    // Use the inverse type if it exists, otherwise use the same type
    const inverseTypeId = relationshipType.inverseId || relationshipTypeId;

    // Both directions are written together, so a failure never leaves one side.
    // Retried as a whole on a sync deadlock (lib/db/deadlock.ts).
    const relationship = await withDeadlockRetry(() => prisma.$transaction(async (tx) => {
      const primary = await tx.relationship.create({
        data: {
          personId,
          relatedPersonId,
          relationshipTypeId,
          notes: notes || null,
        },
      });

      // Only create the inverse if it doesn't exist
      const existingInverse = await tx.relationship.findFirst({
        where: {
          personId: relatedPersonId,
          relatedPersonId: personId,
          relationshipTypeId: inverseTypeId,
          deletedAt: null,
        },
      });

      if (!existingInverse) {
        await tx.relationship.create({
          data: {
            personId: relatedPersonId,
            relatedPersonId: personId,
            relationshipTypeId: inverseTypeId,
            notes: notes || null,
          },
        });
      }

      return primary;
    }));

    return apiResponse.created({ relationship });
  } catch (error) {
    return handleApiError(error, 'relationships-create');
  }
});
