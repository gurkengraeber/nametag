import type { Prisma } from '@prisma/client';

/**
 * The filters of the people list, as they appear in its URL:
 * `group` and `relationship` are an ID or "none", `cf` is "slug:value".
 */
export interface PeopleFilter {
  group?: string;
  relationship?: string;
  cf?: string;
}

export interface CustomFieldFilter {
  slug: string;
  value: string;
}

/** Split a `cf` URL parameter ("slug:value") into its parts, or null when it is not in that form. */
export function parseCustomFieldFilter(cf: string | undefined): CustomFieldFilter | null {
  if (!cf) return null;
  const idx = cf.indexOf(':');
  if (idx <= 0) return null;
  return { slug: cf.slice(0, idx), value: cf.slice(idx + 1) };
}

/** The inverse of parseCustomFieldFilter, for sending an active filter back to the server. */
export function formatCustomFieldFilter(filter: CustomFieldFilter | null): string | undefined {
  return filter ? `${filter.slug}:${filter.value}` : undefined;
}

/**
 * The where clause for the people a filter selects. The people list and the
 * bulk actions both use it, so "select all" always means exactly the people
 * the list shows, across all pages.
 */
export function buildPeopleWhere(userId: string, filter: PeopleFilter = {}): Prisma.PersonWhereInput {
  const where: Prisma.PersonWhereInput = {
    userId,
    deletedAt: null,
  };

  if (filter.group === 'none') {
    where.groups = { none: {} };
  } else if (filter.group) {
    where.groups = { some: { groupId: filter.group } };
  }

  if (filter.relationship === 'none') {
    where.relationshipToUserId = null;
  } else if (filter.relationship) {
    where.relationshipToUserId = filter.relationship;
  }

  const cfFilter = parseCustomFieldFilter(filter.cf);
  if (cfFilter) {
    // Case-insensitive match. Harmless for NUMBER ("42" == "42"), BOOLEAN
    // ("true"/"false" are lowercase), and SELECT (dropdown values match the
    // stored option's exact casing). For TEXT, this lets users find values
    // without remembering the exact casing.
    where.customFieldValues = {
      some: {
        value: { equals: cfFilter.value, mode: 'insensitive' },
        template: {
          slug: cfFilter.slug,
          userId,
          deletedAt: null,
        },
      },
    };
  }

  return where;
}
