import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';
import { getCountryName } from '@/lib/countries';
import { classifyUnplaced } from '@/lib/map/unplaced';
import type {
  MapGroup,
  MapMarker,
  MapPerson,
  UnlocatedPerson,
  UnplacedPerson,
} from '@/lib/map/types';

export const GET = withAuth(async (request, session) => {
  try {
    const [user, people, pendingCount, failedCount, allGroups, relationshipTypes] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { nameOrder: true, nameDisplayFormat: true, geocodingEnabled: true },
      }),
      prisma.person.findMany({
        where: { userId: session.user.id, deletedAt: null },
        select: {
          id: true,
          name: true,
          surname: true,
          nickname: true,
          displayNameOverride: true,
          photo: true,
          lastContact: true,
          relationshipToUserId: true,
          addresses: {
            select: {
              id: true,
              type: true,
              streetLine1: true,
              streetLine2: true,
              locality: true,
              region: true,
              postalCode: true,
              country: true,
              latitude: true,
              longitude: true,
              geocodeStatus: true,
            },
          },
          locations: {
            select: {
              id: true,
              type: true,
              label: true,
              latitude: true,
              longitude: true,
            },
          },
          groups: {
            where: { group: { deletedAt: null } },
            select: { group: { select: { id: true, name: true, color: true } } },
          },
        },
      }),
      prisma.personAddress.count({
        where: {
          person: { userId: session.user.id, deletedAt: null },
          OR: [{ geocodeStatus: null }, { geocodeStatus: 'pending' }],
        },
      }),
      prisma.personAddress.count({
        where: {
          person: { userId: session.user.id, deletedAt: null },
          geocodeStatus: 'failed',
        },
      }),
      prisma.group.findMany({
        where: { userId: session.user.id, deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, color: true },
      }),
      prisma.relationshipType.findMany({
        where: { userId: session.user.id, deletedAt: null },
        orderBy: { label: 'asc' },
        select: { id: true, label: true, color: true },
      }),
    ]);

    const groupsById = new Map<string, MapGroup>();
    const markers: MapMarker[] = [];
    const unlocatedPeople: UnlocatedPerson[] = [];
    const mapPeople: MapPerson[] = [];
    const unplacedPeople: UnplacedPerson[] = [];
    const geocodingEnabled = user?.geocodingEnabled ?? true;

    for (const person of people) {
      // formatGraphName honors the user's name display settings (FULL,
      // NICKNAME_PREFERRED, SHORT) and the per-person override, matching how
      // names render in the network graph and page titles.
      const personName = formatGraphName(
        person,
        user?.nameOrder ?? undefined,
        (user?.nameDisplayFormat as NameDisplayFormat | undefined) ?? undefined,
      );
      const groupIds = person.groups.map((pg) => pg.group.id);
      for (const pg of person.groups) {
        groupsById.set(pg.group.id, pg.group);
      }
      const hasPhoto = Boolean(person.photo);
      // First group (in returned order) that has a color, matching how the
      // network graph picks a node's fill/ring color.
      const groupColor = person.groups.find((pg) => pg.group.color)?.group.color ?? null;

      mapPeople.push({
        personId: person.id,
        personName,
        groupIds,
        relationshipTypeId: person.relationshipToUserId,
        lastContact: person.lastContact ? person.lastContact.toISOString().slice(0, 10) : null,
      });
      const markerCountBefore = markers.length;

      const personFailedCount = person.addresses.filter(
        (address) => address.geocodeStatus === 'failed'
      ).length;
      if (personFailedCount > 0) {
        unlocatedPeople.push({ personId: person.id, personName, failedCount: personFailedCount });
      }

      for (const address of person.addresses) {
        if (address.geocodeStatus !== 'success' || address.latitude === null || address.longitude === null) {
          continue;
        }
        const addressText = [
          address.streetLine1,
          address.streetLine2,
          address.locality,
          address.region,
          address.postalCode,
          address.country ? getCountryName(address.country) || address.country : null,
        ]
          .filter((part) => part && part.trim().length > 0)
          .join(', ');

        markers.push({
          id: `addr_${address.id}`,
          source: 'address',
          personId: person.id,
          personName,
          latitude: Number(address.latitude),
          longitude: Number(address.longitude),
          label: address.type,
          city: address.locality,
          region: address.region,
          country: address.country,
          addressText: addressText || null,
          groupIds,
          hasPhoto,
          groupColor,
        });
      }

      for (const location of person.locations) {
        markers.push({
          id: `loc_${location.id}`,
          source: 'location',
          personId: person.id,
          personName,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          label: location.label ?? location.type,
          city: null,
          region: null,
          country: null,
          addressText: null,
          groupIds,
          hasPhoto,
          groupColor,
        });
      }

      // A contact without any marker goes to the "no place yet" list, with
      // its addresses so the map can offer a quick city and country entry.
      if (markers.length === markerCountBefore) {
        unplacedPeople.push({
          personId: person.id,
          personName,
          reason: classifyUnplaced(person.addresses, geocodingEnabled),
          addresses: person.addresses.map((address) => ({
            type: address.type,
            streetLine1: address.streetLine1,
            streetLine2: address.streetLine2,
            locality: address.locality,
            region: address.region,
            postalCode: address.postalCode,
            country: address.country,
          })),
        });
      }
    }

    const groups = [...groupsById.values()].sort((a, b) => a.name.localeCompare(b.name));
    unlocatedPeople.sort((a, b) => a.personName.localeCompare(b.personName));
    unplacedPeople.sort((a, b) => a.personName.localeCompare(b.personName));
    mapPeople.sort((a, b) => a.personName.localeCompare(b.personName));

    return apiResponse.ok({
      markers,
      groups,
      allGroups,
      relationshipTypes,
      people: mapPeople,
      unplacedPeople,
      pendingCount,
      failedCount,
      unlocatedPeople,
      geocodingEnabled,
    });
  } catch (error) {
    return handleApiError(error, 'map-markers');
  }
});
