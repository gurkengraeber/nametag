import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  typeFindFirst: vi.fn(),
  personUpdateMany: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    relationshipType: { findFirst: mocks.typeFindFirst },
    person: { updateMany: mocks.personUpdateMany },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { POST } from '../../app/api/relationship-types/[id]/members/bulk/route';

const postRequest = (body: unknown) =>
  new Request('http://localhost/api/relationship-types/type-1/members/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const context = { params: Promise.resolve({ id: 'type-1' }) };

describe('POST /api/relationship-types/[id]/members/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when personIds is missing or empty', async () => {
    expect((await POST(postRequest({}), context)).status).toBe(400);
    expect((await POST(postRequest({ personIds: [] }), context)).status).toBe(400);
    expect(mocks.personUpdateMany).not.toHaveBeenCalled();
  });

  it('returns 400 for more than 500 people', async () => {
    const personIds = Array.from({ length: 501 }, (_, i) => `p-${i}`);
    const response = await POST(postRequest({ personIds }), context);
    expect(response.status).toBe(400);
  });

  it('returns 404 when the relationship type is not found for this user', async () => {
    mocks.typeFindFirst.mockResolvedValue(null);

    const response = await POST(postRequest({ personIds: ['p-1'] }), context);

    expect(response.status).toBe(404);
    expect(mocks.typeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'type-1', userId: 'user-123', deletedAt: null } })
    );
    expect(mocks.personUpdateMany).not.toHaveBeenCalled();
  });

  it('updates only the user\'s own people, once per unique id', async () => {
    mocks.typeFindFirst.mockResolvedValue({ id: 'type-1' });
    mocks.personUpdateMany.mockResolvedValue({ count: 2 });

    const response = await POST(postRequest({ personIds: ['p-1', 'p-2', 'p-1'] }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ updated: 2 });
    expect(mocks.personUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p-1', 'p-2'] }, userId: 'user-123', deletedAt: null },
      data: { relationshipToUserId: 'type-1' },
    });
  });

  it('reports zero when none of the ids belong to the user', async () => {
    mocks.typeFindFirst.mockResolvedValue({ id: 'type-1' });
    mocks.personUpdateMany.mockResolvedValue({ count: 0 });

    const response = await POST(postRequest({ personIds: ['foreign'] }), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 0 });
  });
});
