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

import { POST } from '../../app/api/relationship-types/[id]/members/route';
import { DELETE } from '../../app/api/relationship-types/[id]/members/[personId]/route';

const postRequest = (body: unknown) =>
  new Request('http://localhost/api/relationship-types/type-1/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Relationship type members API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/relationship-types/[id]/members', () => {
    const context = { params: Promise.resolve({ id: 'type-1' }) };

    it('returns 400 when personId is missing', async () => {
      const response = await POST(postRequest({}), context);

      expect(response.status).toBe(400);
      expect(mocks.personUpdateMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the relationship type is not found for this user', async () => {
      mocks.typeFindFirst.mockResolvedValue(null);

      const response = await POST(postRequest({ personId: 'person-1' }), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Relationship type not found');
      expect(mocks.typeFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'type-1', userId: 'user-123', deletedAt: null },
        })
      );
    });

    it('returns 404 when the person is not found for this user', async () => {
      mocks.typeFindFirst.mockResolvedValue({ id: 'type-1' });
      mocks.personUpdateMany.mockResolvedValue({ count: 0 });

      const response = await POST(postRequest({ personId: 'person-1' }), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Person not found');
    });

    it('sets the relationship type on the person', async () => {
      mocks.typeFindFirst.mockResolvedValue({ id: 'type-1' });
      mocks.personUpdateMany.mockResolvedValue({ count: 1 });

      const response = await POST(postRequest({ personId: 'person-1' }), context);

      expect(response.status).toBe(200);
      expect(mocks.personUpdateMany).toHaveBeenCalledWith({
        where: { id: 'person-1', userId: 'user-123', deletedAt: null },
        data: { relationshipToUserId: 'type-1' },
      });
    });
  });

  describe('DELETE /api/relationship-types/[id]/members/[personId]', () => {
    const context = { params: Promise.resolve({ id: 'type-1', personId: 'person-1' }) };
    const request = new Request('http://localhost/api/relationship-types/type-1/members/person-1', {
      method: 'DELETE',
    });

    it('returns 404 when the relationship type is not found for this user', async () => {
      mocks.typeFindFirst.mockResolvedValue(null);

      const response = await DELETE(request, context);

      expect(response.status).toBe(404);
      expect(mocks.personUpdateMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the person does not have this relationship', async () => {
      mocks.typeFindFirst.mockResolvedValue({ id: 'type-1' });
      mocks.personUpdateMany.mockResolvedValue({ count: 0 });

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Person does not have this relationship');
    });

    it('clears the relationship only when it matches this type', async () => {
      mocks.typeFindFirst.mockResolvedValue({ id: 'type-1' });
      mocks.personUpdateMany.mockResolvedValue({ count: 1 });

      const response = await DELETE(request, context);

      expect(response.status).toBe(200);
      expect(mocks.personUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'person-1',
          userId: 'user-123',
          deletedAt: null,
          relationshipToUserId: 'type-1',
        },
        data: { relationshipToUserId: null },
      });
    });
  });
});
