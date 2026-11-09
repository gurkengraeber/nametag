import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import DeleteGroupButton from '@/components/DeleteGroupButton';
import Navigation from '@/components/Navigation';
import GroupMembersManager from '@/components/GroupMembersManager';
import GroupMembersView from '@/components/GroupMembersView';
import { getTranslations } from 'next-intl/server';
import { getUserDisplayPreferences } from '@/lib/user-preferences';


export default async function GroupDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('groups');
  const tCommon = await getTranslations('common');

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [group, allPeople, preferences, relationshipTypes] = await Promise.all([
    prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        people: {
          where: {
            person: { deletedAt: null },
          },
          include: {
            person: {
              select: {
                id: true,
                name: true,
                middleName: true,
                surname: true,
                secondLastName: true,
                nickname: true,
                displayNameOverride: true,
                photo: true,
                lastContact: true,
                relationshipToUserId: true,
                addresses: {
                  orderBy: { createdAt: 'asc' },
                  take: 1,
                  select: { locality: true, country: true },
                },
                relationshipsFrom: {
                  where: { deletedAt: null, relatedPerson: { deletedAt: null } },
                  select: {
                    relatedPerson: {
                      select: {
                        id: true,
                        name: true,
                        middleName: true,
                        surname: true,
                        secondLastName: true,
                        nickname: true,
                      },
                    },
                    relationshipType: {
                      where: { deletedAt: null },
                      select: { label: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.person.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
        displayNameOverride: true,
        photo: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    getUserDisplayPreferences(session.user.id),
    prisma.relationshipType.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { label: 'asc' },
      select: { id: true, label: true, color: true },
    }),
  ]);
  const { nameOrder, nameDisplayFormat } = preferences;

  if (!group) {
    notFound();
  }

  const currentMembers = group.people.map((pg) => pg.person);
  const memberRows = currentMembers.map(({ relationshipsFrom, ...member }) => ({
    ...member,
    connections: relationshipsFrom.map((relationship) => ({
      ...relationship.relatedPerson,
      typeLabel: relationship.relationshipType?.label ?? null,
    })),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/groups"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/groups"
              className="text-primary hover:underline text-sm"
            >
              {t('backToGroups')}
            </Link>
          </div>

          <div className="bg-surface shadow rounded-lg overflow-visible">
            <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-center flex-1 min-w-0">
                {group.color && (
                  <div
                    className="w-12 h-12 rounded-full mr-4 flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                )}
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">
                    {group.name}
                  </h1>
                  {group.description && (
                    <p className="text-muted mt-1">
                      {group.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-shrink-0 space-x-3 w-full sm:w-auto">
                <Link
                  href={`/groups/${group.id}/edit`}
                  className="flex-1 sm:flex-none px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:bg-primary-dark transition-colors text-center"
                >
                  {tCommon('edit')}
                </Link>
                <DeleteGroupButton groupId={group.id} groupName={group.name} />
              </div>
            </div>

            <div className="px-6 py-5 space-y-6">
              <GroupMembersView
                groupId={group.id}
                members={memberRows}
                relationshipTypes={relationshipTypes}
                nameOrder={nameOrder}
                nameDisplayFormat={nameDisplayFormat}
              />
              <details open={currentMembers.length === 0}>
                <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">
                  {t('members.manageMembers')}
                </summary>
                <div className="mt-3">
                  <GroupMembersManager
                    groupId={group.id}
                    groupName={group.name}
                    currentMembers={currentMembers.map((member) => ({
                      id: member.id,
                      name: member.name,
                      surname: member.surname,
                      nickname: member.nickname,
                      displayNameOverride: member.displayNameOverride,
                      photo: member.photo,
                    }))}
                    availablePeople={allPeople}
                    nameOrder={nameOrder}
                    nameDisplayFormat={nameDisplayFormat}
                  />
                </div>
              </details>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
