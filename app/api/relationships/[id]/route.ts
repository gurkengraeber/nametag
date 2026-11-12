import { prisma } from '@/lib/prisma';
import { withDeadlockRetry } from '@/lib/db/deadlock';
import { updateRelationshipSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { apiError } from '@/lib/api-errors';

// GET /api/relationships/[id] - Get a single relationship
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const relationship = await prisma.relationship.findFirst({
      where: {
        id,
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
    });

    if (!relationship) {
      return apiResponse.notFound('Relationship not found');
    }

    return apiResponse.ok({ relationship });
  } catch (error) {
    return handleApiError(error, 'relationships-get');
  }
});

// PUT /api/relationships/[id] - Update a relationship
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateRelationshipSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { relationshipTypeId, notes } = validation.data;

    // Find the existing relationship
    const existing = await prisma.relationship.findUnique({
      where: { id, deletedAt: null },
      include: {
        person: true,
        relatedPerson: true,
      },
    });

    if (!existing) {
      return apiResponse.notFound('Relationship not found');
    }

    // Verify the person belongs to the user
    if (existing.person.userId !== session.user.id) {
      return apiResponse.unauthorized();
    }

    if (!relationshipTypeId) {
      return apiError('relationship_type_required', 'Relationship type is required');
    }

    // Get the new relationship type to find its inverse
    const relationshipType = await prisma.relationshipType.findFirst({
      where: {
        id: relationshipTypeId,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!relationshipType) {
      return apiResponse.notFound('Relationship type not found');
    }

    // Both directions change together, so a failure never leaves one side behind.
    // Retried as a whole on a sync deadlock (lib/db/deadlock.ts).
    const relationship = await withDeadlockRetry(() => prisma.$transaction(async (tx) => {
      const primary = await tx.relationship.update({
        where: { id },
        data: {
          relationshipTypeId,
          notes: notes || null,
        },
      });

      // Find and update the inverse relationship
      const inverse = await tx.relationship.findFirst({
        where: {
          personId: existing.relatedPersonId,
          relatedPersonId: existing.personId,
          deletedAt: null,
        },
      });

      if (inverse && relationshipType.inverseId) {
        await tx.relationship.update({
          where: { id: inverse.id },
          data: {
            relationshipTypeId: relationshipType.inverseId,
            notes: notes || null,
          },
        });
      }

      return primary;
    }));

    return apiResponse.ok({ relationship });
  } catch (error) {
    return handleApiError(error, 'relationships-update');
  }
});

// DELETE /api/relationships/[id] - Delete a relationship
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Find the existing relationship
    const existing = await prisma.relationship.findUnique({
      where: { id, deletedAt: null },
      include: {
        person: true,
        relationshipType: { select: { inverseId: true } },
      },
    });

    if (!existing) {
      return apiResponse.notFound('Relationship not found');
    }

    // Verify the person belongs to the user
    if (existing.person.userId !== session.user.id) {
      return apiResponse.unauthorized();
    }

    // Both directions are removed together, so a failure never leaves one side behind.
    // Retried as a whole on a sync deadlock (lib/db/deadlock.ts).
    await withDeadlockRetry(() => prisma.$transaction(async (tx) => {
      // Soft delete the primary relationship (set deletedAt instead of removing)
      await tx.relationship.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Find and soft delete the inverse relationship. Only the row that carries
      // the inverse type belongs to this one; a second, unrelated relationship
      // between the same two people stays. A type without an inverse is its own.
      const inverseTypeId = existing.relationshipType?.inverseId ?? existing.relationshipTypeId;
      const inverse = await tx.relationship.findFirst({
        where: {
          personId: existing.relatedPersonId,
          relatedPersonId: existing.personId,
          deletedAt: null,
          OR: [
            { relationshipTypeId: inverseTypeId },
            ...(existing.relationshipTypeId
              ? [{ relationshipType: { inverseId: existing.relationshipTypeId } }]
              : []),
          ],
        },
      });

      if (inverse) {
        await tx.relationship.update({
          where: { id: inverse.id },
          data: {
            deletedAt: new Date(),
          },
        });
      }
    }));

    return apiResponse.message('Relationship deleted successfully');
  } catch (error) {
    return handleApiError(error, 'relationships-delete');
  }
});
