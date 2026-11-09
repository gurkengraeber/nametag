import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import GroupsOverview from '@/components/GroupsOverview';
import { canCreateResource } from '@/lib/billing/subscription';
import { getTranslations } from 'next-intl/server';
import { getUserDisplayPreferences } from '@/lib/user-preferences';
import { formatFullName } from '@/lib/nameUtils';

const PREVIEW_MEMBERS = 4;

export default async function GroupsPage() {
  const session = await auth();
  const t = await getTranslations('groups');

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user can create more groups
  const canCreate = await canCreateResource(session.user.id, 'groups');

  const [{ nameOrder }, groups] = await Promise.all([
    getUserDisplayPreferences(session.user.id),
    prisma.group.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        _count: {
          select: {
            people: { where: { person: { deletedAt: null } } },
          },
        },
        people: {
          where: { person: { deletedAt: null } },
          orderBy: { person: { name: 'asc' } },
          take: PREVIEW_MEMBERS,
          select: {
            person: {
              select: {
                name: true,
                surname: true,
                nickname: true,
                displayNameOverride: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const items = groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    color: group.color,
    memberCount: group._count.people,
    preview: group.people.map((pg) => formatFullName(pg.person, nameOrder)),
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              {t('title')}
            </h1>
            {canCreate.allowed ? (
              <Button href="/groups/new">
                {t('addGroup')}
              </Button>
            ) : (
              <div className="relative group">
                <span className="px-4 py-2 min-h-11 sm:min-h-0 bg-muted/50 text-white rounded-lg font-semibold cursor-not-allowed inline-flex items-center justify-center">
                  {t('addGroup')}
                </span>
                <div className="invisible group-hover:visible absolute right-0 top-full mt-2 w-64 p-3 bg-surface-elevated text-white text-sm rounded-lg shadow-lg z-10">
                  <p className="mb-2">{t('limitReached', { limit: canCreate.limit })}</p>
                  <Link href="/settings/billing" className="text-primary hover:text-primary-dark underline">
                    {t('upgradePlan')}
                  </Link>
                </div>
              </div>
            )}
          </div>

          <GroupsOverview
            groups={items}
            canCreate={canCreate.allowed}
            limit={canCreate.allowed ? undefined : canCreate.limit}
          />
        </div>
      </main>
    </div>
  );
}
