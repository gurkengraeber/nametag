import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import InstallPrompt from '@/components/InstallPrompt';
import { prisma } from '@/lib/prisma';
import UnifiedNetworkGraph from '@/components/UnifiedNetworkGraph';
import GraphFilterHelpModal from '@/components/GraphFilterHelpModal';
import { formatDate, formatDateWithoutYear } from '@/lib/date-format';
import { getUpcomingEvents } from '@/lib/upcoming-events';
import { getTranslations } from 'next-intl/server';
import DashboardGreeting from '@/components/DashboardGreeting';
import DashboardUpcomingEvents, { type DashboardEventItem } from '@/components/DashboardUpcomingEvents';
import { getUserDisplayPreferences } from '@/lib/user-preferences';

export default async function DashboardPage() {
  const session = await auth();
  const t = await getTranslations('dashboard');

  if (!session?.user) {
    redirect('/login');
  }

  const { dateFormat, graphMode } = await getUserDisplayPreferences(session.user.id);

  // Fetch groups, upcoming events, and people count
  const [groups, upcomingEvents, peopleCount] = await Promise.all([
    prisma.group.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    getUpcomingEvents(session.user.id),
    prisma.person.count({
      where: { userId: session.user.id, deletedAt: null },
    }),
  ]);

  // Helper function to format days until
  const formatDaysUntil = (days: number): string => {
    if (days === 0) return t('today');
    if (days === 1) return t('tomorrow');
    if (days < 7) return t('inDays', { days });
    if (days < 14) return t('inWeek');
    return t('inWeeks', { weeks: Math.floor(days / 7) });
  };

  // Upcoming events as plain data for the client list (labels are made here)
  const eventItems: DashboardEventItem[] = upcomingEvents.map((event) => ({
    id: event.id,
    personId: event.personId,
    personName: event.personName,
    personPhoto: event.personPhoto ?? null,
    title: (event.titleKey ? t(event.titleKey) : event.title) ?? '',
    dueLabel: event.daysUntil < 0 ? t('overdue') : formatDaysUntil(event.daysUntil),
    dateLabel: event.isYearUnknown
      ? formatDateWithoutYear(event.date, dateFormat)
      : formatDate(event.date, dateFormat),
    urgency: event.daysUntil <= 0 ? 'overdue' : event.daysUntil <= 3 ? 'soon' : 'later',
    canMarkContacted: event.type === 'contact_reminder',
  }));
  const dueThisWeek = upcomingEvents.filter((event) => event.daysUntil <= 7).length;

  const statChipClass =
    'inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 px-3 sm:py-1 text-sm text-muted rounded-full border border-border bg-surface hover:text-foreground hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/dashboard"
      />

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Greeting and key figures in one slim row, so the network fits on the first screen */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            <DashboardGreeting name={session.user.nickname || session.user.name || ''} />
          </h1>
          {peopleCount > 0 && (
            <nav aria-label={t('stats.ariaLabel')} className="flex flex-wrap gap-2">
              <Link href="/people" className={statChipClass}>
                {t('stats.people', { count: peopleCount })}
              </Link>
              <Link href="/groups" className={statChipClass}>
                {t('stats.groups', { count: groups.length })}
              </Link>
              {dueThisWeek > 0 && (
                <a href="#upcoming" className={statChipClass}>
                  {t('stats.thisWeek', { count: dueThisWeek })}
                </a>
              )}
            </nav>
          )}
        </div>

        <InstallPrompt />

        {/* Network graph: takes the rest of the screen height */}
        {peopleCount > 0 ? (
          <div className="bg-surface rounded-lg p-3 sm:p-4 border border-border">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">
                {t('yourNetwork')}
              </h2>
              <GraphFilterHelpModal />
            </div>
            <UnifiedNetworkGraph
              apiEndpoint="/api/dashboard/graph"
              groups={groups}
              centerNodeNonClickable={true}
              graphMode={graphMode}
            />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <div className="bg-surface rounded-lg p-6 border border-border">
              <div className="text-center py-16">
                <div className="flex justify-center mb-5">
                  <svg className="w-10 h-10 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t('emptyNetwork.title')}
                </h3>
                <p className="text-sm text-muted mb-8 max-w-sm mx-auto">
                  {t('emptyNetwork.description')}
                </p>
                <Link
                  href="/people/new"
                  className="inline-flex items-center px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary hover:bg-primary-dark text-on-primary transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  {t('emptyNetwork.action')}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming events and reminders, below the network */}
        <div className="max-w-7xl mx-auto">
          <DashboardUpcomingEvents events={eventItems} />
        </div>
      </main>
    </div>
  );
}
