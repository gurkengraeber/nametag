import { describe, it, expect, beforeEach, vi } from 'vitest';

interface FakeType {
  id: string;
  userId: string;
  name: string;
  label: string;
  color: string | null;
  inverseId: string | null;
  deletedAt: Date | null;
}

const state = vi.hoisted(() => ({ types: [] as FakeType[], counter: 0 }));

vi.mock('../../lib/prisma', () => {
  const relationshipType = {
    findMany: vi.fn(async ({ where }: { where: { userId: string; deletedAt: null } }) =>
      state.types.filter((t) => t.userId === where.userId && t.deletedAt === null)
    ),
    create: vi.fn(async ({ data }: { data: Omit<FakeType, 'id' | 'inverseId' | 'deletedAt'> }) => {
      const created: FakeType = {
        id: `t-${++state.counter}`,
        inverseId: null,
        deletedAt: null,
        ...data,
      };
      state.types.push(created);
      return created;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { inverseId: string } }) => {
      const type = state.types.find((t) => t.id === where.id);
      if (type) type.inverseId = data.inverseId;
      return type;
    }),
  };
  return { prisma: { relationshipType } };
});

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { POST } from '../../app/api/relationship-types/defaults/route';
import {
  createMissingPreloadedRelationshipTypes,
  PRELOADED_RELATIONSHIP_TYPES,
} from '../../lib/relationship-types';
import { prisma } from '../../lib/prisma';

const seed = (name: string, extra: Partial<FakeType> = {}): FakeType => {
  const type: FakeType = {
    id: `seed-${++state.counter}`,
    userId: 'user-123',
    name,
    label: name,
    color: null,
    inverseId: null,
    deletedAt: null,
    ...extra,
  };
  state.types.push(type);
  return type;
};

const byName = (name: string) => state.types.find((t) => t.name === name);

describe('createMissingPreloadedRelationshipTypes', () => {
  beforeEach(() => {
    state.types = [];
    state.counter = 0;
  });

  it('creates every standard type with correct inverses for an empty list', async () => {
    const result = await createMissingPreloadedRelationshipTypes(prisma, 'user-123');

    expect(result).toEqual({ created: PRELOADED_RELATIONSHIP_TYPES.length, skipped: 0 });
    expect(state.types).toHaveLength(PRELOADED_RELATIONSHIP_TYPES.length);
    expect(byName('FRIEND')?.inverseId).toBe(byName('FRIEND')?.id);
    expect(byName('PARENT')?.inverseId).toBe(byName('CHILD')?.id);
    expect(byName('CHILD')?.inverseId).toBe(byName('PARENT')?.id);
  });

  it('leaves existing types alone and only creates the missing ones', async () => {
    const friend = seed('FRIEND', { label: 'Best friend', color: '#000000' });

    const result = await createMissingPreloadedRelationshipTypes(prisma, 'user-123');

    expect(result.created).toBe(PRELOADED_RELATIONSHIP_TYPES.length - 1);
    expect(result.skipped).toBe(1);
    expect(state.types.filter((t) => t.name === 'FRIEND')).toHaveLength(1);
    expect(friend.label).toBe('Best friend');
    expect(friend.inverseId).toBeNull();
  });

  it('is a no-op when everything already exists', async () => {
    await createMissingPreloadedRelationshipTypes(prisma, 'user-123');
    const before = state.types.length;

    const result = await createMissingPreloadedRelationshipTypes(prisma, 'user-123');

    expect(result).toEqual({ created: 0, skipped: PRELOADED_RELATIONSHIP_TYPES.length });
    expect(state.types).toHaveLength(before);
  });

  it('links a recreated counterpart to an existing partner without an inverse', async () => {
    const parent = seed('PARENT');

    await createMissingPreloadedRelationshipTypes(prisma, 'user-123');

    const child = byName('CHILD');
    expect(child?.inverseId).toBe(parent.id);
    expect(parent.inverseId).toBe(child?.id);
  });

  it('does not overwrite an existing partner that already has an inverse', async () => {
    const other = seed('SOMETHING');
    const parent = seed('PARENT', { inverseId: other.id });

    await createMissingPreloadedRelationshipTypes(prisma, 'user-123');

    expect(parent.inverseId).toBe(other.id);
    expect(byName('CHILD')?.inverseId).toBe(parent.id);
  });

  it('uses translated labels and derives the internal name from them', async () => {
    await createMissingPreloadedRelationshipTypes(prisma, 'user-123', {
      FRIEND: 'Guter Freund',
      PARENT: 'Elternteil',
      CHILD: 'Kind',
    });

    const friend = byName('GUTER_FREUND');
    expect(friend?.label).toBe('Guter Freund');
    expect(friend?.inverseId).toBe(friend?.id);
    expect(byName('ELTERNTEIL')?.inverseId).toBe(byName('KIND')?.id);
    expect(byName('FRIEND')).toBeUndefined();
  });

  it('ignores deleted types', async () => {
    seed('FRIEND', { deletedAt: new Date() });

    const result = await createMissingPreloadedRelationshipTypes(prisma, 'user-123');

    expect(result.created).toBe(PRELOADED_RELATIONSHIP_TYPES.length);
  });

  it('does not create two types for the same translated name', async () => {
    const result = await createMissingPreloadedRelationshipTypes(prisma, 'user-123', {
      SPOUSE: 'Partner',
    });

    expect(state.types.filter((t) => t.name === 'PARTNER')).toHaveLength(1);
    expect(result.created).toBe(PRELOADED_RELATIONSHIP_TYPES.length - 1);
  });
});

describe('POST /api/relationship-types/defaults', () => {
  beforeEach(() => {
    state.types = [];
    state.counter = 0;
  });

  const request = (body: unknown) =>
    new Request('http://localhost/api/relationship-types/defaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('returns 201 with the counts when types were created', async () => {
    const response = await POST(request({}));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ created: PRELOADED_RELATIONSHIP_TYPES.length, skipped: 0 });
  });

  it('returns 200 when nothing was missing', async () => {
    await POST(request({}));
    const response = await POST(request({}));

    expect(response.status).toBe(200);
    expect((await response.json()).created).toBe(0);
  });

  it('accepts translated labels', async () => {
    const response = await POST(request({ labels: { FRIEND: 'Amigo' } }));

    expect(response.status).toBe(201);
    expect(byName('AMIGO')?.label).toBe('Amigo');
  });

  it('rejects labels that are empty or too long', async () => {
    expect((await POST(request({ labels: { FRIEND: '' } }))).status).toBe(400);
    expect(
      (await POST(request({ labels: { FRIEND: 'x'.repeat(51) } }))).status
    ).toBe(400);
  });
});
