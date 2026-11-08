import { describe, it, expect, beforeEach, vi } from 'vitest';

type Where = Record<string, unknown>;

interface FakePerson {
  id: string;
  userId: string;
  groupIds: string[];
  relationshipToUserId: string | null;
}

// Three people of the user and one of somebody else, to see who a bulk action reaches
const people: FakePerson[] = [
  { id: 'p1', userId: 'user-123', groupIds: ['g1'], relationshipToUserId: 'rt1' },
  { id: 'p2', userId: 'user-123', groupIds: ['g1', 'g2'], relationshipToUserId: null },
  { id: 'p3', userId: 'user-123', groupIds: [], relationshipToUserId: null },
  { id: 'other', userId: 'user-999', groupIds: ['g1'], relationshipToUserId: null },
];

/** Answers findMany the way the database would for the filters the people list uses. */
function fakeFindMany({ where }: { where: Where }) {
  const groups = where.groups as { none?: unknown; some?: { groupId: string } } | undefined;
  const ids = (where.id as { in: string[] } | undefined)?.in;

  return Promise.resolve(
    people
      .filter((person) => person.userId === where.userId)
      .filter((person) => !ids || ids.includes(person.id))
      .filter((person) => {
        if (!groups) return true;
        if (groups.none) return person.groupIds.length === 0;
        return groups.some ? person.groupIds.includes(groups.some.groupId) : true;
      })
      .filter((person) =>
        'relationshipToUserId' in where ? person.relationshipToUserId === where.relationshipToUserId : true
      )
      .map((person) => ({ id: person.id }))
  );
}

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  personUpdateMany: vi.fn(),
  personGroupCreateMany: vi.fn(),
  personGroupFindMany: vi.fn(),
  groupFindMany: vi.fn(),
  cardDavMappingDeleteMany: vi.fn(),
  relationshipTypeFindFirst: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: { findMany: mocks.personFindMany, updateMany: mocks.personUpdateMany },
    personGroup: { createMany: mocks.personGroupCreateMany, findMany: mocks.personGroupFindMany },
    group: { findMany: mocks.groupFindMany },
    cardDavMapping: { deleteMany: mocks.cardDavMappingDeleteMany },
    relationshipType: { findFirst: mocks.relationshipTypeFindFirst },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

vi.mock('../../lib/carddav/delete-contact', () => ({ deleteFromCardDav: vi.fn() }));
vi.mock('../../lib/carddav/group-sync', () => ({ batchSyncPersonsToCardDav: vi.fn(() => Promise.resolve()) }));

import { POST } from '../../app/api/people/bulk/route';

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/people/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

const deleteBody = { action: 'delete', deleteOrphans: false, deleteFromCardDav: false };

const deletedIds = () => {
  const call = mocks.personUpdateMany.mock.calls[0][0] as { where: { id: { in: string[] } } };
  return call.where.id.in;
};

describe('Bulk actions with "select all" and the filters of the people list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personFindMany.mockImplementation(fakeFindMany);
    mocks.personUpdateMany.mockResolvedValue({ count: 0 });
    mocks.cardDavMappingDeleteMany.mockResolvedValue({ count: 0 });
    mocks.personGroupFindMany.mockResolvedValue([]);
    mocks.personGroupCreateMany.mockResolvedValue({ count: 0 });
    mocks.groupFindMany.mockResolvedValue([{ id: 'g3' }]);
    mocks.relationshipTypeFindFirst.mockResolvedValue({ id: 'rt2', userId: 'user-123' });
  });

  describe('delete', () => {
    it('deletes only the people of the active group filter', async () => {
      await post({ ...deleteBody, selectAll: true, filter: { group: 'g1' } });

      expect(deletedIds()).toEqual(['p1', 'p2']);
    });

    it('deletes only people without a group when that filter is active', async () => {
      await post({ ...deleteBody, selectAll: true, filter: { group: 'none' } });

      expect(deletedIds()).toEqual(['p3']);
    });

    it('deletes only the people of the active relationship filter', async () => {
      await post({ ...deleteBody, selectAll: true, filter: { relationship: 'rt1' } });

      expect(deletedIds()).toEqual(['p1']);
    });

    it('combines the filters, so a person must match all of them', async () => {
      await post({ ...deleteBody, selectAll: true, filter: { group: 'g1', relationship: 'none' } });

      expect(deletedIds()).toEqual(['p2']);
    });

    it('never reaches people of another user', async () => {
      await post({ ...deleteBody, selectAll: true, filter: { group: 'g1' } });

      expect(deletedIds()).not.toContain('other');
    });

    it('still means every person of the user when no filter is active', async () => {
      await post({ ...deleteBody, selectAll: true });

      expect(deletedIds()).toEqual(['p1', 'p2', 'p3']);
    });

    it('asks the database for the custom field filter of the list', async () => {
      await post({ ...deleteBody, selectAll: true, filter: { cf: 'pet:Dog' } });

      expect(mocks.personFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            deletedAt: null,
            customFieldValues: {
              some: {
                value: { equals: 'Dog', mode: 'insensitive' },
                template: { slug: 'pet', userId: 'user-123', deletedAt: null },
              },
            },
          }),
        })
      );
    });

    it('ignores the filter when explicit ids are given', async () => {
      await post({ ...deleteBody, personIds: ['p3'], filter: { group: 'g1' } });

      expect(deletedIds()).toEqual(['p3']);
    });
  });

  describe('addToGroups', () => {
    it('adds only the filtered people to the group', async () => {
      await post({ action: 'addToGroups', groupIds: ['g3'], selectAll: true, filter: { group: 'none' } });

      expect(mocks.personGroupCreateMany).toHaveBeenCalledWith({
        data: [{ personId: 'p3', groupId: 'g3' }],
        skipDuplicates: true,
      });
    });
  });

  describe('setRelationship', () => {
    it('sets the relationship only for the filtered people', async () => {
      await post({ action: 'setRelationship', relationshipTypeId: 'rt2', selectAll: true, filter: { relationship: 'none' } });

      expect(deletedIds()).toEqual(['p2', 'p3']);
    });
  });

  it('rejects a filter that is not made of strings', async () => {
    const response = await post({ ...deleteBody, selectAll: true, filter: { group: 5 } });

    expect(response.status).toBe(400);
    expect(mocks.personUpdateMany).not.toHaveBeenCalled();
  });
});
