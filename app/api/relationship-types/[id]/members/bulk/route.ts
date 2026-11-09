import { prisma } from '@/lib/prisma';
import { addRelationshipTypeMembersBulkSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

// POST /api/relationship-types/[id]/members/bulk - Set this relationship type for several people at once
export const POST = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;
    const body = await parseRequestBody(request);
    const validation = validateRequest(addRelationshipTypeMembersBulkSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const personIds = [...new Set(validation.data.personIds)];

    const relationshipType = await prisma.relationshipType.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });

    if (!relationshipType) {
      return apiResponse.notFound('Relationship type not found');
    }

    // Ids that are not the user's own people are silently ignored by the filter.
    const result = await prisma.person.updateMany({
      where: { id: { in: personIds }, userId: session.user.id, deletedAt: null },
      data: { relationshipToUserId: id },
    });

    return apiResponse.ok({ updated: result.count });
  } catch (error) {
    return handleApiError(error, 'relationship-types-add-members-bulk');
  }
});
