import { prisma } from '@/lib/prisma';
import { addRelationshipTypeMemberSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

// POST /api/relationship-types/[id]/members - Set this relationship type as the user's relationship to a person
export const POST = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;
    const body = await parseRequestBody(request);
    const validation = validateRequest(addRelationshipTypeMemberSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { personId } = validation.data;

    const relationshipType = await prisma.relationshipType.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });

    if (!relationshipType) {
      return apiResponse.notFound('Relationship type not found');
    }

    const result = await prisma.person.updateMany({
      where: { id: personId, userId: session.user.id, deletedAt: null },
      data: { relationshipToUserId: id },
    });

    if (result.count === 0) {
      return apiResponse.notFound('Person not found');
    }

    return apiResponse.success();
  } catch (error) {
    return handleApiError(error, 'relationship-types-add-member');
  }
});
