'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';
import { buildEntryPreview, getRelativeDayLabel, splitHighlight } from '@/lib/journal';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Button } from '@/components/ui/Button';

interface TimelineEntry {
  id: string;
  title: string;
  date: string;
  hasTime: boolean;
  body: string;
  people: Array<{
    person: {
      id: string;
      name: string;
      surname: string | null;
      nickname: string | null;
      displayNameOverride?: string | null;
    };
  }>;
}

interface JournalTimelineProps {
  entries: TimelineEntry[];
  nameOrder: string;
  nameDisplayFormat?: NameDisplayFormat;
  locale: string;
  /** Search text from the address bar, highlighted in titles and previews. */
  searchQuery?: string;
  /** True when a person, search or time filter is narrowing the list. */
  hasFilters?: boolean;
  /** People the list is filtered to, so a new entry can start with them tagged. */
  personIds?: string[];
}

interface MonthGroup {
  monthKey: string;
  label: string;
  entries: TimelineEntry[];
}

/** The calendar day of an entry as a local Date (date-only entries are stored as UTC midnight). */
function entryLocalDate(entry: TimelineEntry): Date {
  if (entry.hasTime) return new Date(entry.date);
  const [y, m, d] = entry.date.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

// The clock is read once per minute; the server snapshot is null so markup matches on hydration.
function subscribeNever(): () => void {
  return () => {};
}

function currentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

function Highlighted({ text, query }: { text: string; query?: string }) {
  return (
    <>
      {splitHighlight(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function groupByMonth(entries: TimelineEntry[], locale: string): MonthGroup[] {
  const map = new Map<string, TimelineEntry[]>();

  for (const entry of entries) {
    // Parse as local date to avoid timezone shift
    const [year, month] = entry.date.split('T')[0].split('-').map(Number);
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const existing = map.get(monthKey);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(monthKey, [entry]);
    }
  }

  // Sort month keys descending (newest first)
  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    // Use the 1st of the month as the representative date for formatting
    const representativeDate = new Date(year, month - 1, 1);
    const label = representativeDate.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
    });

    // Entries are already sorted by the server (date desc, createdAt desc)
    // so we preserve insertion order
    const monthEntries = map.get(monthKey) ?? [];

    return { monthKey, label, entries: monthEntries };
  });
}

interface EntryCardProps {
  entry: TimelineEntry;
  nameOrder: string;
  nameDisplayFormat?: NameDisplayFormat;
  searchQuery?: string;
  relativeLabel: string | null;
}

function EntryCard({ entry, nameOrder, nameDisplayFormat, searchQuery, relativeLabel }: EntryCardProps) {
  const t = useTranslations('journal.timeline');
  const [expanded, setExpanded] = useState(false);
  const preview = useMemo(
    () => buildEntryPreview(entry.title, entry.body, searchQuery),
    [entry.title, entry.body, searchQuery],
  );
  const bodyId = `journal-entry-body-${entry.id}`;

  return (
    <article className="group relative bg-surface-elevated border border-border rounded-lg px-4 py-4 hover:border-primary/60 hover:shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors min-w-0 break-words">
          {/* The whole card opens the entry; the buttons below sit above this layer */}
          <Link
            href={`/journal/${entry.id}`}
            className="after:absolute after:inset-0 after:content-[''] focus:outline-none"
          >
            <Highlighted text={entry.title} query={searchQuery} />
          </Link>
        </h3>
        {relativeLabel && (
          <span className="text-xs text-muted whitespace-nowrap flex-shrink-0">{relativeLabel}</span>
        )}
      </div>

      {expanded ? (
        <div id={bodyId} className="relative z-10 mb-1 break-words">
          <MarkdownRenderer content={entry.body} />
        </div>
      ) : (
        preview.text && (
          <p id={bodyId} className="text-sm text-muted line-clamp-3 mb-1 leading-relaxed break-words">
            <Highlighted text={preview.text} query={searchQuery} />
          </p>
        )
      )}

      {preview.isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="relative z-10 inline-flex items-center min-h-11 sm:min-h-0 text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          {expanded ? t('showLess') : t('showMore')}
        </button>
      )}

      {entry.people.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {entry.people.map(({ person }) => (
            <span
              key={person.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
            >
              {formatGraphName(person, nameOrder as 'WESTERN' | 'EASTERN' | undefined, nameDisplayFormat)}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export default function JournalTimeline({
  entries,
  nameOrder,
  nameDisplayFormat,
  locale,
  searchQuery,
  hasFilters = false,
  personIds = [],
}: JournalTimelineProps) {
  const t = useTranslations('journal');
  const groups = useMemo(() => groupByMonth(entries, locale), [entries, locale]);
  // Relative labels depend on the viewer's clock, so they appear after mount.
  const nowMinute = useSyncExternalStore(subscribeNever, currentMinute, () => null);
  const now = nowMinute === null ? null : new Date(nowMinute * 60_000);

  const newEntryHref = personIds.length > 0 ? `/journal/new?person=${personIds.join(',')}` : '/journal/new';

  if (entries.length === 0 && hasFilters) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-medium text-foreground mb-2">{t('noResults')}</p>
        <p className="text-sm text-muted mb-6 max-w-md mx-auto">{t('noResultsDescription')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button href="/journal" variant="secondary">
            {t('clearFilters')}
          </Button>
          <Button href={newEntryHref}>{t('writeEntry')}</Button>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-medium text-foreground mb-2">{t('noEntries')}</p>
        <p className="text-sm text-muted mb-6 max-w-md mx-auto">{t('noEntriesDescription')}</p>
        <Link
          href="/journal/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-on-primary bg-primary hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          {t('writeFirstEntry')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {hasFilters && (
        <div className="flex items-center justify-between gap-3 -mt-2">
          <p className="text-sm text-muted" role="status">
            {t('resultCount', { count: entries.length })}
          </p>
          <Link
            href="/journal"
            className="text-sm text-primary hover:underline inline-flex items-center min-h-11 sm:min-h-0"
          >
            {t('clearFilters')}
          </Link>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.monthKey} aria-label={group.label}>
          {/* Month header */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-accent whitespace-nowrap">
              {group.label}
            </span>
            <div className="flex-1 h-px bg-border" aria-hidden="true" />
          </div>

          {/* Entries */}
          <div className="space-y-0">
            {group.entries.map((entry, index) => {
              const isLast = index === group.entries.length - 1;
              const entryDate = entryLocalDate(entry);
              const dayNumber = entryDate.getDate();
              const weekday = entryDate.toLocaleDateString(locale, { weekday: 'short' });
              const timeLabel = entry.hasTime
                ? entryDate.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
                : null;

              return (
                <div key={entry.id} className="flex gap-0">
                  {/* Date column */}
                  <div className="w-14 sm:w-16 flex-shrink-0 flex flex-col items-center pt-1 pr-2 sm:pr-3">
                    <span
                      className="text-2xl font-bold text-foreground leading-none tabular-nums"
                      aria-label={
                        timeLabel
                          ? `${entryDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}, ${timeLabel}`
                          : entryDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
                      }
                    >
                      {dayNumber}
                    </span>
                    <span className="text-xs text-muted uppercase tracking-wide mt-0.5">
                      {weekday}
                    </span>
                    {timeLabel && (
                      <span className="text-xs text-muted tabular-nums mt-0.5 whitespace-nowrap">
                        {timeLabel}
                      </span>
                    )}
                  </div>

                  {/* Timeline spine */}
                  <div className="flex flex-col items-center flex-shrink-0 w-6 mr-4">
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-surface mt-1.5 z-10 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {!isLast && (
                      <div className="w-px flex-1 bg-border mt-1" aria-hidden="true" />
                    )}
                  </div>

                  {/* Entry card */}
                  <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-6'}`}>
                    <EntryCard
                      entry={entry}
                      nameOrder={nameOrder}
                      nameDisplayFormat={nameDisplayFormat}
                      searchQuery={searchQuery}
                      relativeLabel={now ? getRelativeDayLabel(entryDate, now, locale) : null}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
