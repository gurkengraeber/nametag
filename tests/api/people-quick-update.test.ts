import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  personUpdate: vi.fn(),
  typeFindFirst: vi.fn(),
  addressUpdate: vi.fn(),
  addressCreate: vi.fn(),
  autoUpdatePerson: vi.fn(),
  geocodePersonAddresses: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: { findUnique: mocks.personFindUnique, update: mocks.personUpdate },
    relationshipType: { findFirst: mocks.typeFindFirst },
    personAddress: { update: mocks.addressUpdate, create: mocks.addressCreate },
  },
}));

vi.mock('../../lib/carddav/auto-export', () => ({
  autoUpdatePerson: mocks.autoUpdatePerson,
}));

vi.mock('../../lib/geocoding/geocode-person', () => ({
  geocodePersonAddresses: mocks.geocodePersonAddresses,
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { PATCH } from '../../app/api/people/[id]/quick-update/route';

const context = { params: Promise.resolve({ id: 'person-1' }) };

const patch = (body: unknown) =>
  PATCH(
    new Request('http://localhost/api/people/person-1/quick-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context
  );

const existingPerson = (overrides: Record<string, unknown> = {}) => ({
  cardDavSyncEnabled: true,
  addresses: [{ id: 'address-1' }],
  ...overrides,
});

describe('PATCH /api/people/[id]/quick-update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.autoUpdatePerson.mockResolvedValue(undefined);
    mocks.geocodePersonAddresses.mockResolvedValue(undefined);
    mocks.personUpdate.mockResolvedValue({});
    mocks.addressUpdate.mockResolvedValue({});
    mocks.addressCreate.mockResolvedValue({});
  });

  it('returns 400 for an empty body', async () => {
    const response = await patch({});

    expect(response.status).toBe(400);
    expect(mocks.personFindUnique).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid date', async () => {
    const response = await patch({ lastContact: 'tomorrow' });

    expect(response.status).toBe(400);
    expect(mocks.personUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the person does not belong to the user', async () => {
    mocks.personFindUnique.mockResolvedValueOnce(null);

    const response = await patch({ lastContact: '2026-11-08' });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Person not found');
    expect(mocks.personFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'person-1', userId: 'user-123', deletedAt: null } })
    );
  });

  it('returns 404 when the relationship type is not found for this user', async () => {
    mocks.personFindUnique.mockResolvedValueOnce(existingPerson());
    mocks.typeFindFirst.mockResolvedValueOnce(null);

    const response = await patch({ relationshipToUserId: 'type-1' });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Relationship type not found');
    expect(mocks.typeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'type-1', userId: 'user-123', deletedAt: null } })
    );
    expect(mocks.personUpdate).not.toHaveBeenCalled();
  });

  it('sets the last contact date, bumps updatedAt and updates CardDAV', async () => {
    mocks.personFindUnique
      .mockResolvedValueOnce(existingPerson())
      .mockResolvedValueOnce({
        id: 'person-1',
        lastContact: new Date('2026-11-08'),
        relationshipToUserId: null,
        addresses: [],
      });

    const response = await patch({ lastContact: '2026-11-08' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.person.lastContact).toBe('2026-11-08T00:00:00.000Z');
    expect(mocks.personUpdate).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { updatedAt: expect.any(Date), lastContact: new Date('2026-11-08') },
    });
    expect(mocks.autoUpdatePerson).toHaveBeenCalledWith('person-1');
    expect(mocks.geocodePersonAddresses).not.toHaveBeenCalled();
  });

  it('clears the last contact date with null or an empty string', async () => {
    mocks.personFindUnique.mockResolvedValue(existingPerson());

    await patch({ lastContact: '' });

    expect(mocks.personUpdate).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { updatedAt: expect.any(Date), lastContact: null },
    });
  });

  it('sets the relationship without touching the vCard', async () => {
    mocks.personFindUnique.mockResolvedValue(existingPerson());
    mocks.typeFindFirst.mockResolvedValueOnce({ id: 'type-1' });

    const response = await patch({ relationshipToUserId: 'type-1' });

    expect(response.status).toBe(200);
    expect(mocks.personUpdate).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { relationshipToUserId: 'type-1' },
    });
    expect(mocks.autoUpdatePerson).not.toHaveBeenCalled();
  });

  it('clears the relationship without looking up a type', async () => {
    mocks.personFindUnique.mockResolvedValue(existingPerson());

    const response = await patch({ relationshipToUserId: null });

    expect(response.status).toBe(200);
    expect(mocks.typeFindFirst).not.toHaveBeenCalled();
    expect(mocks.personUpdate).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { relationshipToUserId: null },
    });
  });

  it('changes city and country on the first address and geocodes again', async () => {
    mocks.personFindUnique.mockResolvedValue(existingPerson());

    const response = await patch({ city: '  Berlin ', country: 'Germany' });

    expect(response.status).toBe(200);
    expect(mocks.addressUpdate).toHaveBeenCalledWith({
      where: { id: 'address-1' },
      data: { locality: 'Berlin', country: 'Germany' },
    });
    expect(mocks.addressCreate).not.toHaveBeenCalled();
    expect(mocks.geocodePersonAddresses).toHaveBeenCalledWith('person-1');
    expect(mocks.autoUpdatePerson).toHaveBeenCalledWith('person-1');
  });

  it('only changes the field that was sent', async () => {
    mocks.personFindUnique.mockResolvedValue(existingPerson());

    await patch({ city: 'Hamburg' });

    expect(mocks.addressUpdate).toHaveBeenCalledWith({
      where: { id: 'address-1' },
      data: { locality: 'Hamburg' },
    });
  });

  it('clears an empty city to null but keeps the address row', async () => {
    mocks.personFindUnique.mockResolvedValue(existingPerson());

    await patch({ city: '' });

    expect(mocks.addressUpdate).toHaveBeenCalledWith({
      where: { id: 'address-1' },
      data: { locality: null },
    });
  });

  it('creates a home address when the person has none', async () => {
    mocks.personFindUnique.mockResolvedValue(existingPerson({ addresses: [] }));

    await patch({ city: 'Lyon', country: 'France' });

    expect(mocks.addressCreate).toHaveBeenCalledWith({
      data: { personId: 'person-1', type: 'home', locality: 'Lyon', country: 'France' },
    });
    expect(mocks.addressUpdate).not.toHaveBeenCalled();
  });

  it('does not create an empty address when there is nothing to store', async () => {
    mocks.personFindUnique.mockResolvedValue(existingPerson({ addresses: [] }));

    await patch({ city: '' });

    expect(mocks.addressCreate).not.toHaveBeenCalled();
  });

  it('skips the CardDAV update when sync is disabled for the person', async () => {
    mocks.personFindUnique.mockResolvedValue(existingPerson({ cardDavSyncEnabled: false }));

    await patch({ lastContact: '2026-11-08' });

    expect(mocks.autoUpdatePerson).not.toHaveBeenCalled();
  });
});
