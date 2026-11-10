import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  relationshipFindFirst: vi.fn(),
  relationshipUpdate: vi.fn(),
  personFindFirst: vi.fn(),
  relationshipTypeFindFirst: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prismaIncludingDeleted: {
    relationship: { findFirst: mocks.relationshipFindFirst, update: mocks.relationshipUpdate },
    person: { findFirst: mocks.personFindFirst },
    relationshipType: { findFirst: mocks.relationshipTypeFindFirst },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: 'user-123', email: 'test@example.com' } })),
}));

import { POST } from '../../app/api/relationships/[id]/restore/route';

const trashed = {
  id: 'rel-1',
  personId: 'person-1',
  relatedPersonId: 'person-2',
  relationshipTypeId: 'type-1',
  deletedAt: new Date('2024-01-01'),
};

function restore() {
  return POST(new Request('http://localhost/api/relationships/rel-1/restore', { method: 'POST' }), {
    params: Promise.resolve({ id: 'rel-1' }),
  });
}

describe('POST /api/relationships/[id]/restore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.personFindFirst.mockResolvedValue(null);
    mocks.relationshipTypeFindFirst.mockResolvedValue(null);
    mocks.relationshipUpdate.mockResolvedValue({ ...trashed, deletedAt: null });
    // First call is the trash guard, second the inverse lookup
    mocks.relationshipFindFirst.mockResolvedValueOnce(trashed).mockResolvedValue(null);
  });

  it('refuses while one of the people is still in the trash', async () => {
    mocks.personFindFirst.mockResolvedValue({ id: 'person-2' });

    const res = await restore();

    expect(res.status).toBe(409);
    expect(mocks.relationshipUpdate).not.toHaveBeenCalled();
    expect(mocks.personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['person-1', 'person-2'] },
          userId: 'user-123',
          deletedAt: { not: null },
        },
      })
    );
  });

  it('refuses while the relationship type is still in the trash', async () => {
    mocks.relationshipTypeFindFirst.mockResolvedValue({ id: 'type-1' });

    const res = await restore();

    expect(res.status).toBe(409);
    expect(mocks.relationshipUpdate).not.toHaveBeenCalled();
    expect(mocks.relationshipTypeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'type-1', userId: 'user-123', deletedAt: { not: null } },
      })
    );
  });

  it('restores when the people and the type are live', async () => {
    const res = await restore();

    expect(res.status).toBe(200);
    expect(mocks.relationshipUpdate).toHaveBeenCalledWith({ where: { id: 'rel-1' }, data: { deletedAt: null } });
  });

  it('skips the type check for a relationship without a type', async () => {
    mocks.relationshipFindFirst.mockReset();
    mocks.relationshipFindFirst.mockResolvedValueOnce({ ...trashed, relationshipTypeId: null }).mockResolvedValue(null);

    const res = await restore();

    expect(res.status).toBe(200);
    expect(mocks.relationshipTypeFindFirst).not.toHaveBeenCalled();
  });
});
