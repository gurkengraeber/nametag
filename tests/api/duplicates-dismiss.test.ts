import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: { findMany: mocks.personFindMany },
    duplicateDismissal: { upsert: mocks.upsert, deleteMany: mocks.deleteMany },
  },
}));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    withAuth: (handler: (req: Request, session: unknown, ctx: unknown) => Promise<Response>) =>
      (req: Request) =>
        handler(req, { user: { id: 'u1' }, authMethod: 'session' }, { params: Promise.resolve({}) }),
  };
});

import { DELETE, POST } from '@/app/api/people/duplicates/dismiss/route';

function request(method: string, body: unknown): Request {
  return new Request('http://localhost/api/people/duplicates/dismiss', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/people/duplicates/dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST stores the pair with the smaller id first', async () => {
    mocks.personFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const res = await POST(request('POST', { personAId: 'b', personBId: 'a' }));
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'u1', personAId: 'a', personBId: 'b' },
      })
    );
  });

  it('DELETE removes the dismissal so the pair is suggested again', async () => {
    const res = await DELETE(request('DELETE', { personAId: 'b', personBId: 'a' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dismissed: false });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', personAId: 'a', personBId: 'b' },
    });
  });

  it('DELETE rejects a body without both ids', async () => {
    const res = await DELETE(request('DELETE', { personAId: 'a' }));
    expect(res.status).toBe(400);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
