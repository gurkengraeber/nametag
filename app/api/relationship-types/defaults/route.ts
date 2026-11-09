import { prisma } from '@/lib/prisma';
import { createDefaultRelationshipTypesSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { createMissingPreloadedRelationshipTypes } from '@/lib/relationship-types';

// POST /api/relationship-types/defaults - Create the standard relationship types the user is missing
export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(createDefaultRelationshipTypesSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const result = await createMissingPreloadedRelationshipTypes(
      prisma,
      session.user.id,
      validation.data.labels
    );

    return apiResponse.ok({ ...result }, result.created > 0 ? 201 : 200);
  } catch (error) {
    return handleApiError(error, 'relationship-types-create-defaults');
  }
});
