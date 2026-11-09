import { prisma } from '@/lib/prisma';
import { apiResponse, withAuth } from '@/lib/api-utils';

export const GET = withAuth(async (_request, session) => {
  const people = await prisma.person.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      surname: true,
      middleName: true,
      secondLastName: true,
      nickname: true,
      displayNameOverride: true,
      organization: true,
      jobTitle: true,
      notes: true,
      photo: true,
      lastContact: true,
      relationshipToUser: { select: { id: true, label: true, deletedAt: true } },
      phoneNumbers: { select: { number: true } },
      emails: { select: { email: true } },
      addresses: {
        select: {
          streetLine1: true,
          streetLine2: true,
          locality: true,
          region: true,
          postalCode: true,
          country: true,
        },
      },
      urls: { select: { url: true } },
      imHandles: { select: { handle: true } },
      groups: {
        where: { group: { deletedAt: null } },
        include: { group: { select: { id: true, name: true } } },
      },
      customFields: { select: { key: true, value: true } },
      customFieldValues: {
        include: { template: { select: { name: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  const [groups, relationshipTypes] = await Promise.all([
    prisma.group.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.relationshipType.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, label: true },
      orderBy: { label: 'asc' },
    }),
  ]);

  const indexData = people.map((person) => {
    const relationship = person.relationshipToUser && !person.relationshipToUser.deletedAt
      ? person.relationshipToUser
      : null;

    return {
      id: person.id,
      name: person.name,
      surname: person.surname,
      middleName: person.middleName,
      secondLastName: person.secondLastName,
      nickname: person.nickname,
      displayNameOverride: person.displayNameOverride,
      organization: person.organization,
      jobTitle: person.jobTitle,
      notes: person.notes,
      photo: person.photo,
      phones: person.phoneNumbers.map((p) => p.number).join(' '),
      emails: person.emails.map((e) => e.email).join(' '),
      addresses: person.addresses
        .flatMap((a) => [a.streetLine1, a.streetLine2, a.locality, a.region, a.postalCode, a.country])
        .filter(Boolean)
        .join(' '),
      urls: person.urls.map((u) => u.url).join(' '),
      imHandles: person.imHandles.map((im) => im.handle).join(' '),
      groups: person.groups.map((pg) => pg.group.name).join(' '),
      customFields: [
        ...person.customFields.map((cf) => `${cf.key} ${cf.value}`),
        ...person.customFieldValues.map((cfv) => `${cfv.template.name} ${cfv.value}`),
      ].join(' '),
      // Context shown next to a search hit and used by the quick actions
      relationship: relationship?.label ?? null,
      relationshipTypeId: relationship?.id ?? null,
      locality: person.addresses.find((a) => a.locality)?.locality ?? null,
      groupIds: person.groups.map((pg) => pg.group.id),
      groupNames: person.groups.map((pg) => pg.group.name),
      lastContact: person.lastContact ? person.lastContact.toISOString().slice(0, 10) : null,
    };
  });

  return apiResponse.ok({ people: indexData, groups, relationshipTypes });
});
