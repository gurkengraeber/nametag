import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Navigation from '@/components/Navigation';
import JournalEntryForm from '@/components/JournalEntryForm';
import { getUserDisplayPreferences } from '@/lib/user-preferences';
import { parseDateParam, parsePersonIds, recentPersonIds } from '@/lib/journal';

// /journal/new?person=<id>[,<id>...]&date=YYYY-MM-DD opens the form with those
// people tagged and that day chosen, so other pages can link straight here.
export default async function NewJournalEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; date?: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('journal');

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  const [preferences, availablePeople, recentEntries] = await Promise.all([
    getUserDisplayPreferences(session.user.id),
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
      },
      orderBy: { name: 'asc' },
    }),
    prisma.journalEntry.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: {
        people: {
          where: { person: { deletedAt: null } },
          select: { personId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const knownIds = new Set(availablePeople.map((p) => p.id));
  const prefillPersonIds = parsePersonIds(params.person).filter((id) => knownIds.has(id));
  const prefillDate = parseDateParam(params.date) ?? undefined;
  const returnHref =
    prefillPersonIds.length > 0 ? `/journal?person=${prefillPersonIds.join(',')}` : '/journal';

  const { nameOrder, dateFormat } = preferences;

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/journal"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            {t('newEntry')}
          </h1>

          <div className="bg-surface shadow rounded-lg p-4 sm:p-6">
            <JournalEntryForm
              userId={session.user.id}
              mode="create"
              availablePeople={availablePeople}
              nameOrder={nameOrder}
              dateFormat={dateFormat}
              prefill={{ personIds: prefillPersonIds, date: prefillDate }}
              recentPersonIds={recentPersonIds(recentEntries, 6)}
              returnHref={returnHref}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
