import { prisma } from '@/lib/prisma';
import { quickUpdatePersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { autoUpdatePerson } from '@/lib/carddav/auto-export';
import { geocodePersonAddresses } from '@/lib/geocoding/geocode-person';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('people');

// PATCH /api/people/[id]/quick-update - Change last contact, relationship or city/country of one person
export const PATCH = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;
    const body = await parseRequestBody(request);
    const validation = validateRequest(quickUpdatePersonSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { lastContact, relationshipToUserId, city, country } = validation.data;

    const person = await prisma.person.findUnique({
      where: { id, userId: session.user.id, deletedAt: null },
      select: {
        cardDavSyncEnabled: true,
        addresses: { orderBy: { createdAt: 'asc' }, take: 1, select: { id: true } },
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    if (relationshipToUserId) {
      const relationshipType = await prisma.relationshipType.findFirst({
        where: { id: relationshipToUserId, userId: session.user.id, deletedAt: null },
        select: { id: true },
      });

      if (!relationshipType) {
        return apiResponse.notFound('Relationship type not found');
      }
    }

    const addressChanged = city !== undefined || country !== undefined;
    if (addressChanged) {
      const addressData = {
        ...(city !== undefined && { locality: city || null }),
        ...(country !== undefined && { country: country || null }),
      };
      const firstAddress = person.addresses[0];

      if (firstAddress) {
        await prisma.personAddress.update({ where: { id: firstAddress.id }, data: addressData });
      } else if (city || country) {
        await prisma.personAddress.create({
          data: { personId: id, type: 'home', ...addressData },
        });
      }
    }

    // Only a changed last contact or address reaches the vCard, so only those
    // bump updatedAt (CardDAV conflict detection compares it) and trigger an update.
    const vCardChanged = lastContact !== undefined || addressChanged;
    if (vCardChanged || relationshipToUserId !== undefined) {
      await prisma.person.update({
        where: { id },
        data: {
          ...(vCardChanged && { updatedAt: new Date() }),
          ...(lastContact !== undefined && { lastContact: lastContact ? new Date(lastContact) : null }),
          ...(relationshipToUserId !== undefined && { relationshipToUserId }),
        },
      });
    }

    if (vCardChanged && person.cardDavSyncEnabled) {
      autoUpdatePerson(id).catch((error: unknown) => {
        log.error(
          { err: error instanceof Error ? error : new Error(String(error)), personId: id },
          'CardDAV auto-update after quick update failed',
        );
      });
    }

    if (addressChanged) {
      geocodePersonAddresses(id).catch((error: unknown) => {
        log.error(
          { err: error instanceof Error ? error : new Error(String(error)), personId: id },
          'Background geocoding after quick update failed',
        );
      });
    }

    const updated = await prisma.person.findUnique({
      where: { id, userId: session.user.id, deletedAt: null },
      select: {
        id: true,
        lastContact: true,
        relationshipToUserId: true,
        addresses: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { locality: true, country: true },
        },
      },
    });

    return apiResponse.ok({
      person: {
        id,
        lastContact: updated?.lastContact ?? null,
        relationshipToUserId: updated?.relationshipToUserId ?? null,
        city: updated?.addresses[0]?.locality ?? null,
        country: updated?.addresses[0]?.country ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error, 'people-quick-update');
  }
});
