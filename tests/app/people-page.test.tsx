import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personCount: vi.fn(),
  personFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: 'user-1', email: 'a@example.com', name: 'A' } })),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: { count: mocks.personCount, findMany: mocks.personFindMany },
    group: { findMany: vi.fn().mockResolvedValue([]) },
    relationshipType: { findMany: vi.fn().mockResolvedValue([]) },
    customFieldTemplate: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('@/lib/billing/subscription', () => ({
  canCreateResource: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('@/lib/user-preferences', () => ({
  getUserDisplayPreferences: vi.fn().mockResolvedValue({ nameOrder: 'WESTERN', nameDisplayFormat: 'FULL' }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/components/Navigation', () => ({ default: () => null }));
vi.mock('@/components/ImportSuccessToast', () => ({ default: () => null }));
vi.mock('@/components/PeopleListClient', () => ({ default: () => null }));

import PeoplePage from '../../app/people/page';

describe('People page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personCount.mockResolvedValue(0);
    mocks.personFindMany.mockResolvedValue([]);
  });

  it('does not count deleted relationships when marking people without connections', async () => {
    await PeoplePage({ searchParams: Promise.resolve({}) });

    const { include } = mocks.personFindMany.mock.calls[0][0];
    expect(include.relationshipsFrom.where).toEqual({ deletedAt: null });
    expect(include.relationshipsTo.where).toEqual({ deletedAt: null });
  });
});
