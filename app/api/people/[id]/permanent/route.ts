import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';
import { withDeadlockRetry } from '@/lib/db/deadlock';
import { deletePersonPhotos } from '@/lib/photo-storage';

// DELETE /api/people/[id]/permanent - Permanently delete a trashed person
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const guard = await requireTrashedRecord(
      () =>
        prismaIncludingDeleted.person.findFirst({
          where: { id, userId: session.user.id },
        }),
      { notFound: 'Person not found', notDeleted: 'Person is not deleted' }
    );
    if (!guard.ok) return guard.response;

    // One transaction: a failure part way must not leave a half-emptied person
    // in the trash. Child records go first, in foreign key order.
    const db = prismaIncludingDeleted;
    await withDeadlockRetry(() => db.$transaction([
      db.journalEntryPerson.deleteMany({ where: { personId: id } }),
      db.duplicateDismissal.deleteMany({ where: { OR: [{ personAId: id }, { personBId: id }] } }),
      db.cardDavMapping.deleteMany({ where: { personId: id } }),
      db.personCustomFieldValue.deleteMany({ where: { personId: id } }),
      db.personCustomField.deleteMany({ where: { personId: id } }),
      db.personLocation.deleteMany({ where: { personId: id } }),
      db.personIM.deleteMany({ where: { personId: id } }),
      db.personUrl.deleteMany({ where: { personId: id } }),
      db.personAddress.deleteMany({ where: { personId: id } }),
      db.personEmail.deleteMany({ where: { personId: id } }),
      db.personPhone.deleteMany({ where: { personId: id } }),
      db.importantDate.deleteMany({ where: { personId: id } }),
      db.relationship.deleteMany({ where: { OR: [{ personId: id }, { relatedPersonId: id }] } }),
      db.personGroup.deleteMany({ where: { personId: id } }),
      db.person.delete({ where: { id } }),
    ]));

    // Photo files last: they cannot be rolled back
    await deletePersonPhotos(session.user.id, id);

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'people-permanent-delete');
  }
});
