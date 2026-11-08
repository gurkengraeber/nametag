import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// DELETE /api/relationship-types/[id]/members/[personId] - Clear the user's relationship to a person
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id, personId } = await context.params;

    const relationshipType = await prisma.relationshipType.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });

    if (!relationshipType) {
      return apiResponse.notFound('Relationship type not found');
    }

    const result = await prisma.person.updateMany({
      where: {
        id: personId,
        userId: session.user.id,
        deletedAt: null,
        relationshipToUserId: id,
      },
      data: { relationshipToUserId: null },
    });

    if (result.count === 0) {
      return apiResponse.notFound('Person does not have this relationship');
    }

    return apiResponse.success();
  } catch (error) {
    return handleApiError(error, 'relationship-types-remove-member');
  }
});
