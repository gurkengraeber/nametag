import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// POST /api/journal/[id]/restore - Restore a soft-deleted journal entry
export const POST = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Journal entries are not filtered by the soft-delete client, so the plain
    // client still sees a deleted entry. Ownership is part of the lookup, so
    // another user's entry reads as missing.
    const guard = await requireTrashedRecord(
      () =>
        prisma.journalEntry.findFirst({
          where: { id, userId: session.user.id },
        }),
      {
        notFound: 'Journal entry not found',
        notDeleted: 'Journal entry is not deleted',
      }
    );
    if (!guard.ok) return guard.response;

    const entry = await prisma.journalEntry.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        people: {
          where: { person: { deletedAt: null } },
          include: {
            person: {
              select: {
                id: true,
                name: true,
                surname: true,
                nickname: true,
                displayNameOverride: true,
              },
            },
          },
        },
      },
    });

    return apiResponse.ok({ entry });
  } catch (error) {
    return handleApiError(error, 'journal-restore');
  }
});
