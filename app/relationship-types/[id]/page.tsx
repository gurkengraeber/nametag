import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import RelationshipTypeMembersManager from '@/components/RelationshipTypeMembersManager';
import { getTranslations } from 'next-intl/server';
import { getUserDisplayPreferences } from '@/lib/user-preferences';

export default async function RelationshipTypeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('relationshipTypes');
  const tCommon = await getTranslations('common');

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [relationshipType, people, preferences] = await Promise.all([
    prisma.relationshipType.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
      include: {
        inverse: { select: { id: true, label: true } },
      },
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
        relationshipToUser: { select: { label: true } },
        groups: {
          where: { group: { deletedAt: null } },
          select: { group: { select: { id: true, name: true, color: true } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    getUserDisplayPreferences(session.user.id),
  ]);
  const { nameOrder, nameDisplayFormat, dateFormat } = preferences;

  if (!relationshipType) {
    notFound();
  }

  const rows = people.map((person) => ({
    id: person.id,
    name: person.name,
    surname: person.surname,
    nickname: person.nickname,
    displayNameOverride: person.displayNameOverride,
    photo: person.photo,
    lastContact: person.lastContact ? person.lastContact.toISOString() : null,
    groups: person.groups.map((pg) => pg.group),
    currentRelationship: person.relationshipToUser?.label ?? null,
    isMember: person.relationshipToUserId === relationshipType.id,
  }));
  const currentMembers = rows.filter((row) => row.isMember);
  const availablePeople = rows.filter((row) => !row.isMember);

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/relationship-types"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link href="/relationship-types" className="text-primary hover:underline text-sm">
              {t('backToTypes')}
            </Link>
          </div>

          <div className="bg-surface shadow rounded-lg overflow-visible">
            <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-center flex-1 min-w-0">
                <div
                  className="w-12 h-12 rounded-full mr-4 flex-shrink-0"
                  style={{ backgroundColor: relationshipType.color || 'var(--badge-bg)' }}
                />
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">
                    {relationshipType.label}
                  </h1>
                  {relationshipType.inverse && (
                    <p className="text-muted mt-1">
                      {t('inverseRelationship')}: {relationshipType.inverse.label}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-shrink-0 space-x-3 w-full sm:w-auto">
                <Link
                  href={`/relationship-types/${relationshipType.id}/edit`}
                  className="flex-1 sm:flex-none px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:bg-primary-dark transition-colors text-center"
                >
                  {tCommon('edit')}
                </Link>
              </div>
            </div>

            <div className="px-6 py-5">
              <RelationshipTypeMembersManager
                typeId={relationshipType.id}
                typeLabel={relationshipType.label}
                currentMembers={currentMembers}
                availablePeople={availablePeople}
                nameOrder={nameOrder}
                nameDisplayFormat={nameDisplayFormat}
                dateFormat={dateFormat}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
