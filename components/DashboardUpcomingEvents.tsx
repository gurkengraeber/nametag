'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import PersonAvatar from './PersonPhoto';
import { getLocalDateString } from '@/lib/date-format';

export interface DashboardEventItem {
  id: string;
  personId: string;
  personName: string;
  personPhoto: string | null;
  title: string;
  /** "Today", "In 3 days", "Overdue" */
  dueLabel: string;
  /** The formatted date of the event */
  dateLabel: string;
  urgency: 'overdue' | 'soon' | 'later';
  /** Contact reminders can be settled right here by noting a conversation today */
  canMarkContacted: boolean;
}

interface DashboardUpcomingEventsProps {
  events: DashboardEventItem[];
}

const URGENCY_CLASS: Record<DashboardEventItem['urgency'], string> = {
  overdue: 'text-warning',
  soon: 'text-accent',
  later: 'text-muted',
};

export default function DashboardUpcomingEvents({ events }: DashboardUpcomingEventsProps) {
  const t = useTranslations('dashboard');
  const tPeople = useTranslations('people');
  const router = useRouter();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = events.filter((event) => !doneIds.has(event.id));
  if (visible.length === 0) return null;

  const markContacted = async (event: DashboardEventItem) => {
    setBusyId(event.id);
    try {
      const response = await fetch(`/api/people/${event.personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastContact: getLocalDateString() }),
      });
      if (!response.ok) throw new Error('Failed to update last contact');
      setDoneIds((prev) => new Set(prev).add(event.id));
      toast.success(tPeople('lastContactUpdated'));
      router.refresh();
    } catch {
      toast.error(tPeople('lastContactUpdateError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section id="upcoming" className="bg-surface rounded-lg p-4 sm:p-6 mt-6 border border-border scroll-mt-4">
      <h2 className="text-xl font-bold text-foreground mb-4">
        {t('upcomingEvents')}
      </h2>
      <ul className="space-y-2">
        {visible.map((event) => (
          <li
            key={event.id}
            className="flex items-center gap-2 bg-surface-elevated rounded-lg transition-colors"
          >
            <Link
              href={`/people/${event.personId}`}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 p-3 sm:p-4 rounded-lg hover:bg-surface-elevated/80 transition-colors"
            >
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <PersonAvatar personId={event.personId} name={event.personName} photo={event.personPhoto} size={40} />
                <div className="min-w-0">
                  <div className="text-foreground font-semibold truncate">
                    {event.personName}
                  </div>
                  <div className="text-sm text-muted truncate">
                    {event.title}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-semibold ${URGENCY_CLASS[event.urgency]}`}>
                  {event.dueLabel}
                </div>
                <div className="text-xs text-muted">{event.dateLabel}</div>
              </div>
            </Link>
            {event.canMarkContacted && (
              <button
                type="button"
                onClick={() => markContacted(event)}
                disabled={busyId === event.id}
                aria-label={t('markContactedAria', { name: event.personName })}
                title={t('markContactedAria', { name: event.personName })}
                className="mr-2 sm:mr-3 inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-xs font-medium rounded-full border border-border text-muted hover:text-primary hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="hidden sm:inline">{t('markContacted')}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
