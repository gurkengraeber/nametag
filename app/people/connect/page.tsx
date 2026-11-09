import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import BackLink from '@/components/BackLink';
import EmptyState from '@/components/EmptyState';
import RelationshipBuilder from '@/components/RelationshipBuilder';
import { formatCanonicalName } from '@/lib/nameUtils';
import { getUserDisplayPreferences } from '@/lib/user-preferences';
import type { BuilderLink, BuilderPerson, BuilderType } from '@/lib/relationship-builder';

export default async function ConnectPeoplePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const t = await getTranslations('relationshipBuilder');
  const tPeople = await getTranslations('people');

  const [people, groups, relationshipTypes, relationships, preferences] = await Promise.all([
    prisma.person.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        middleName: true,
        surname: true,
        secondLastName: true,
        nickname: true,
        displayNameOverride: true,
        photo: true,
        relationshipToUser: { select: { label: true } },
        groups: {
          where: { group: { deletedAt: null } },
          select: { groupId: true },
        },
      },
    }),
    prisma.group.findMany({
      where: { userId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.relationshipType.findMany({
      where: { userId, deletedAt: null },
      orderBy: { label: 'asc' },
      select: { id: true, name: true, label: true, color: true, inverseId: true },
    }),
    prisma.relationship.findMany({
      where: {
        deletedAt: null,
        person: { userId, deletedAt: null },
        relatedPerson: { userId, deletedAt: null },
        relationshipTypeId: { not: null },
        relationshipType: { deletedAt: null },
      },
      select: { id: true, personId: true, relatedPersonId: true, relationshipTypeId: true },
    }),
    getUserDisplayPreferences(userId),
  ]);

  const builderPeople: BuilderPerson[] = people
    .map((person) => ({
      id: person.id,
      displayName: formatCanonicalName(person, preferences.nameOrder),
      secondary: person.displayNameOverride,
      nickname: person.nickname,
      photo: person.photo,
      relationshipLabel: person.relationshipToUser?.label ?? null,
      groupIds: person.groups.map((membership) => membership.groupId),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const builderTypes: BuilderType[] = relationshipTypes;

  const builderLinks: BuilderLink[] = [];
  for (const relationship of relationships) {
    if (relationship.relationshipTypeId) {
      builderLinks.push({
        id: relationship.id,
        personId: relationship.personId,
        relatedPersonId: relationship.relatedPersonId,
        relationshipTypeId: relationship.relationshipTypeId,
      });
    }
  }

  const needsPeople = builderPeople.length < 2;
  const needsTypes = builderTypes.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/people"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-4">
            <BackLink
              fallbackHref="/people"
              className="inline-flex items-center min-h-11 sm:min-h-0 text-primary hover:underline text-sm"
            >
              {tPeople('backToPeople')}
            </BackLink>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-4">{t('title')}</h1>

          {needsPeople || needsTypes ? (
            <div className="bg-surface rounded-lg border border-border">
              {needsPeople ? (
                <EmptyState
                  title={t('empty.noPeopleTitle')}
                  description={t('empty.noPeopleDescription')}
                  actionLabel={t('empty.addPerson')}
                  actionHref="/people/new"
                />
              ) : (
                <EmptyState
                  title={t('empty.noTypesTitle')}
                  description={t('empty.noTypesDescription')}
                  actionLabel={t('empty.createType')}
                  actionHref="/relationship-types/new"
                />
              )}
            </div>
          ) : (
            <RelationshipBuilder
              userId={userId}
              people={builderPeople}
              groups={groups}
              types={builderTypes}
              initialLinks={builderLinks}
            />
          )}
        </div>
      </main>
    </div>
  );
}
