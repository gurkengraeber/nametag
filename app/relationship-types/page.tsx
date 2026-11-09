import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/EmptyState';
import DefaultRelationshipTypesButton from '@/components/DefaultRelationshipTypesButton';
import { PRELOADED_RELATIONSHIP_TYPES } from '@/lib/relationship-types';
import { countConnections } from '@/lib/relationship-type-stats';
import DeleteRelationshipTypeButton from '@/components/DeleteRelationshipTypeButton';
import { getTranslations } from 'next-intl/server';

export default async function RelationshipTypesPage() {
  const session = await auth();
  const t = await getTranslations('relationshipTypes');

  if (!session?.user) {
    redirect('/login');
  }

  const relationshipTypes = await prisma.relationshipType.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    include: {
      inverse: {
        select: {
          id: true,
          name: true,
          label: true,
        },
      },
      _count: {
        select: {
          relationships: {
            where: {
              deletedAt: null,
              person: { deletedAt: null },
              relatedPerson: { deletedAt: null },
            },
          },
          peopleWithRelation: {
            where: { deletedAt: null },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // People you have this relationship with, and connections between people
  const relationshipTypesWithUsage = relationshipTypes.map((type) => ({
    ...type,
    peopleCount: type._count.peopleWithRelation,
    connectionCount: countConnections(type._count.relationships, type),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/relationship-types"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              {t('title')}
            </h1>
            <Button href="/relationship-types/new">
              {t('createNewType')}
            </Button>
          </div>

          {relationshipTypesWithUsage.length > 0 ? (
            <div className="bg-surface shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      {t('color')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      {t('relationship')}
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      {t('inverseRelationship')}
                    </th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      {t('peopleColumn')}
                    </th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      {t('connectionsColumn')}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                  {relationshipTypesWithUsage.map((type) => (
                    <tr key={type.id} className="hover:bg-surface-elevated">
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: type.color || 'var(--badge-bg)' }}
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <Link
                          href={`/relationship-types/${type.id}`}
                          className="inline-flex items-center gap-2 min-h-11 sm:min-h-0 text-sm font-medium text-primary hover:underline"
                        >
                          <span
                            className="sm:hidden w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: type.color || 'var(--badge-bg)' }}
                          />
                          {type.label}
                        </Link>
                        <div className="sm:hidden text-xs text-muted">
                          {t('peopleCount', { count: type.peopleCount })}
                          {', '}
                          {t('connectionsCount', { count: type.connectionCount })}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                        {type.inverse ? (
                          <span className="text-sm text-foreground">
                            {type.inverse.label}
                          </span>
                        ) : (
                          <span className="text-sm text-muted">
                            -
                          </span>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm">
                        {type.peopleCount > 0 ? (
                          <Link
                            href={`/relationship-types/${type.id}`}
                            className="text-primary hover:underline"
                          >
                            {type.peopleCount}
                          </Link>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {type.connectionCount}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1 sm:gap-3">
                          <Link
                            href={`/relationship-types/${type.id}/edit`}
                            className="inline-flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto text-primary hover:text-primary-dark transition-colors"
                            title={t('edit')}
                            aria-label={t('edit')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <DeleteRelationshipTypeButton
                            relationshipTypeId={type.id}
                            relationshipTypeName={type.label}
                            peopleCount={type.peopleCount}
                            connectionCount={type.connectionCount}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-surface shadow rounded-lg">
              <EmptyState
                icon={
                  <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-lg inline-block">
                    <svg className="w-12 h-12 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                }
                title={t('noRelationshipTypes')}
                description={t('noRelationshipTypesDescription')}
                actionLabel={t('createRelationshipType')}
                actionHref="/relationship-types/new"
              />
              <div className="px-6 pb-8 text-center">
                <p className="text-sm text-muted mb-3">{t('defaults.intro')}</p>
                <DefaultRelationshipTypesButton
                  labels={Object.fromEntries(
                    PRELOADED_RELATIONSHIP_TYPES.map(({ name }) => [name, t(`defaults.labels.${name}`)])
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
