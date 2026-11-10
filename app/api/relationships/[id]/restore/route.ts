import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// POST /api/relationships/[id]/restore - Restore a soft-deleted relationship
export const POST = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Ownership lives on the relationship's person, so it goes in the lookup:
    // another user's relationship reads as missing rather than forbidden.
    const guard = await requireTrashedRecord(
      () =>
        prismaIncludingDeleted.relationship.findFirst({
          where: { id, person: { userId: session.user.id } },
        }),
      {
        notFound: 'Relationship not found',
        notDeleted: 'Relationship is not deleted',
      }
    );
    if (!guard.ok) return guard.response;

    const relationship = guard.record;
    const userId = session.user.id;

    // A relationship only makes sense next to live people and a live type, so
    // restoring it while one of them is still in the trash would bring back a
    // row that every list hides again.
    const [trashedPerson, trashedType] = await Promise.all([
      prismaIncludingDeleted.person.findFirst({
        where: {
          id: { in: [relationship.personId, relationship.relatedPersonId] },
          userId,
          deletedAt: { not: null },
        },
        select: { id: true },
      }),
      relationship.relationshipTypeId
        ? prismaIncludingDeleted.relationshipType.findFirst({
            where: { id: relationship.relationshipTypeId, userId, deletedAt: { not: null } },
            select: { id: true },
          })
        : null,
    ]);
    if (trashedPerson) {
      return apiResponse.error('Restore both people of this relationship first', 409);
    }
    if (trashedType) {
      return apiResponse.error('Restore the relationship type first', 409);
    }

    const restored = await prismaIncludingDeleted.relationship.update({
      where: { id },
      data: { deletedAt: null },
    });

    // Also restore the inverse relationship if it exists and was deleted too
    const inverse = await prismaIncludingDeleted.relationship.findFirst({
      where: {
        personId: relationship.relatedPersonId,
        relatedPersonId: relationship.personId,
        deletedAt: { not: null },
        // Leave the inverse in the trash when its own type is still there
        OR: [{ relationshipTypeId: null }, { relationshipType: { deletedAt: null } }],
      },
    });

    if (inverse) {
      await prismaIncludingDeleted.relationship.update({
        where: { id: inverse.id },
        data: { deletedAt: null },
      });
    }

    return apiResponse.ok({ relationship: restored });
  } catch (error) {
    return handleApiError(error, 'relationships-restore');
  }
});
