import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  groupFindMany: vi.fn(),
  relationshipTypeFindMany: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: { findMany: mocks.personFindMany },
    group: { findMany: mocks.groupFindMany },
    relationshipType: { findMany: mocks.relationshipTypeFindMany },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

vi.mock('../../lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { GET } from '../../app/api/people/search-index/route';

describe('GET /api/people/search-index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.groupFindMany.mockResolvedValue([]);
    mocks.relationshipTypeFindMany.mockResolvedValue([]);
  });

  it('should return denormalized search data', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Maria',
        surname: 'Garcia',
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: 'Majo',
        organization: 'Acme',
        jobTitle: 'Dev',
        notes: 'Test note',
        photo: null,
        phoneNumbers: [{ number: '+34 612 345 678' }],
        emails: [{ email: 'maria@acme.com' }],
        addresses: [{
          streetLine1: '123 Main',
          streetLine2: null,
          locality: 'Madrid',
          region: null,
          postalCode: '28001',
          country: 'Spain',
        }],
        urls: [{ url: 'https://maria.dev' }],
        imHandles: [{ handle: 'maria_telegram' }],
        groups: [{ group: { id: 'g1', name: 'Work' } }],
        lastContact: new Date('2026-03-04T00:00:00.000Z'),
        relationshipToUser: { id: 'rt1', label: 'Friend', deletedAt: null },
        customFields: [{ key: 'hobby', value: 'painting' }],
        customFieldValues: [{ value: 'Blue', template: { name: 'Favorite Color' } }],
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/people/search-index');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.people).toHaveLength(1);

    const person = data.people[0];
    expect(person.id).toBe('p1');
    expect(person.name).toBe('Maria');
    expect(person.surname).toBe('Garcia');
    expect(person.displayNameOverride).toBe('Majo');
    expect(person.organization).toBe('Acme');
    expect(person.phones).toBe('+34 612 345 678');
    expect(person.emails).toBe('maria@acme.com');
    expect(person.addresses).toContain('Madrid');
    expect(person.addresses).toContain('Spain');
    expect(person.addresses).toContain('28001');
    expect(person.urls).toBe('https://maria.dev');
    expect(person.imHandles).toBe('maria_telegram');
    expect(person.groups).toBe('Work');
    expect(person.customFields).toContain('painting');
    expect(person.customFields).toContain('hobby');
    expect(person.customFields).toContain('Favorite Color');
    expect(person.customFields).toContain('Blue');
  });

  it('should return empty array when user has no people', async () => {
    mocks.personFindMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/people/search-index');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.people).toEqual([]);
  });

  it('should filter by current user and exclude soft-deleted', async () => {
    mocks.personFindMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/people/search-index');
    await GET(request);

    expect(mocks.personFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user123', deletedAt: null },
      })
    );
  });

  it('should handle person with no multi-value fields', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'p2',
        name: 'Solo',
        surname: null,
        middleName: null,
        secondLastName: null,
        nickname: null,
        organization: null,
        jobTitle: null,
        notes: null,
        photo: null,
        phoneNumbers: [],
        emails: [],
        addresses: [],
        urls: [],
        imHandles: [],
        groups: [],
        customFields: [],
        customFieldValues: [],
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/people/search-index');
    const response = await GET(request);
    const data = await response.json();

    const person = data.people[0];
    expect(person.phones).toBe('');
    expect(person.emails).toBe('');
    expect(person.addresses).toBe('');
    expect(person.urls).toBe('');
    expect(person.imHandles).toBe('');
    expect(person.groups).toBe('');
    expect(person.customFields).toBe('');
  });

  it('should add context for search hits and quick actions', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'p3',
        name: 'Ada',
        surname: null,
        middleName: null,
        secondLastName: null,
        nickname: null,
        organization: null,
        jobTitle: null,
        notes: null,
        photo: null,
        lastContact: new Date('2026-03-04T00:00:00.000Z'),
        relationshipToUser: { id: 'rt1', label: 'Friend', deletedAt: null },
        phoneNumbers: [],
        emails: [],
        addresses: [
          { streetLine1: null, streetLine2: null, locality: null, region: null, postalCode: null, country: 'Spain' },
          { streetLine1: null, streetLine2: null, locality: 'Madrid', region: null, postalCode: null, country: 'Spain' },
        ],
        urls: [],
        imHandles: [],
        groups: [{ group: { id: 'g1', name: 'Work' } }, { group: { id: 'g2', name: 'Chess' } }],
        customFields: [],
        customFieldValues: [],
      },
    ]);

    const response = await GET(new NextRequest('http://localhost:3000/api/people/search-index'));
    const person = (await response.json()).people[0];

    expect(person.relationship).toBe('Friend');
    expect(person.relationshipTypeId).toBe('rt1');
    expect(person.locality).toBe('Madrid');
    expect(person.groupIds).toEqual(['g1', 'g2']);
    expect(person.groupNames).toEqual(['Work', 'Chess']);
    expect(person.lastContact).toBe('2026-03-04');
  });

  it('should ignore a soft-deleted relationship type', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'p4',
        name: 'Bo',
        surname: null,
        middleName: null,
        secondLastName: null,
        nickname: null,
        organization: null,
        jobTitle: null,
        notes: null,
        photo: null,
        lastContact: null,
        relationshipToUser: { id: 'rt9', label: 'Gone', deletedAt: new Date() },
        phoneNumbers: [],
        emails: [],
        addresses: [],
        urls: [],
        imHandles: [],
        groups: [],
        customFields: [],
        customFieldValues: [],
      },
    ]);

    const response = await GET(new NextRequest('http://localhost:3000/api/people/search-index'));
    const person = (await response.json()).people[0];

    expect(person.relationship).toBeNull();
    expect(person.relationshipTypeId).toBeNull();
    expect(person.lastContact).toBeNull();
  });

  it('should return the groups and relationship types the quick actions offer', async () => {
    mocks.personFindMany.mockResolvedValue([]);
    mocks.groupFindMany.mockResolvedValue([{ id: 'g1', name: 'Work' }]);
    mocks.relationshipTypeFindMany.mockResolvedValue([{ id: 'rt1', label: 'Friend' }]);

    const response = await GET(new NextRequest('http://localhost:3000/api/people/search-index'));
    const data = await response.json();

    expect(data.groups).toEqual([{ id: 'g1', name: 'Work' }]);
    expect(data.relationshipTypes).toEqual([{ id: 'rt1', label: 'Friend' }]);
    expect(mocks.groupFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user123', deletedAt: null } })
    );
    expect(mocks.relationshipTypeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user123', deletedAt: null } })
    );
  });
});
