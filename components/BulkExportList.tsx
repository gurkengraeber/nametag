'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import BatchProgress from '@/components/carddav/BatchProgress';
import ListToolbar from '@/components/carddav/ListToolbar';
import ResultSummary from '@/components/carddav/ResultSummary';
import {
  EXPORT_BATCH_SIZE,
  addExportResult,
  emptyExportTotals,
  type ExportTotals,
} from '@/lib/carddav-ui/import-batch';
import {
  areAllSelected,
  filterBySearch,
  pruneSelection,
  runInBatches,
  selectionStats,
  toggleOne,
  toggleVisible,
} from '@/lib/carddav-ui/selection';

interface Person {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  displayNameOverride?: string | null;
  organization: string | null;
  jobTitle: string | null;
  groups: Array<{
    group: {
      id: string;
      name: string;
      color: string | null;
    };
  }>;
  phoneNumbers: Array<{
    type: string;
    number: string;
  }>;
  emails: Array<{
    type: string;
    email: string;
  }>;
}

interface BulkExportListProps {
  people: Person[];
}

type Phase = 'select' | 'running' | 'done';

function displayNameOf(person: Person): string {
  return person.displayNameOverride || [person.name, person.surname].filter(Boolean).join(' ');
}

export default function BulkExportList({ people }: BulkExportListProps) {
  const t = useTranslations('settings.carddav.export');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('select');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [totals, setTotals] = useState<ExportTotals>(emptyExportTotals());
  const [notSent, setNotSent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const visiblePeople = useMemo(
    () =>
      filterBySearch(people, query, (p) => [
        displayNameOf(p),
        p.name,
        p.surname,
        p.nickname,
        p.organization,
        ...p.emails.map((e) => e.email),
        ...p.phoneNumbers.map((n) => n.number),
      ]),
    [people, query],
  );
  const visibleIds = useMemo(() => visiblePeople.map((p) => p.id), [visiblePeople]);
  // The list shrinks after a refresh; forget people who are no longer in it.
  const validSelected = useMemo(
    () => pruneSelection(selectedIds, people.map((p) => p.id)),
    [selectedIds, people],
  );
  const stats = selectionStats(validSelected, visibleIds);

  const handleExport = async () => {
    const ids = Array.from(validSelected);
    if (ids.length === 0) {
      setError(t('noContactsSelected'));
      return;
    }

    setPhase('running');
    setError(null);
    setTotals(emptyExportTotals());
    setNotSent(0);

    let running = emptyExportTotals();
    const run = await runInBatches(
      ids,
      EXPORT_BATCH_SIZE,
      async (batch) => {
        const response = await fetch('/api/carddav/export-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personIds: batch }),
        });
        const data: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          const body = (data ?? {}) as { error?: string; code?: string };
          throw new Error(body.code === 'feature_disabled' ? t('syncDisabled') : body.error || t('exportFailed'));
        }
        running = addExportResult(running, data);
        setTotals(running);
        return data;
      },
      (done, total) => setProgress({ done, total }),
    );

    setNotSent(ids.length - run.processed);
    if (run.error) {
      setError(run.error instanceof Error ? run.error.message : t('exportFailed'));
    }
    setPhase('done');
  };

  const handleExportMore = () => {
    setSelectedIds(new Set());
    setPhase('select');
    setError(null);
    router.refresh();
  };

  if (phase === 'running') {
    return (
      <BatchProgress
        done={progress.done}
        total={progress.total}
        label={t('exporting')}
        detail={t('progress', { done: progress.done, total: progress.total })}
      />
    );
  }

  if (phase === 'done') {
    const remaining = people.length - totals.exported - totals.skipped;
    return (
      <div className="space-y-4">
        {error && (
          <div role="alert" className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
            <p>{error}</p>
            {notSent > 0 && <p className="text-sm mt-1">{t('notSent', { count: notSent })}</p>}
          </div>
        )}
        <ResultSummary
          title={t('exportComplete')}
          stats={[
            { label: t('statExported'), value: totals.exported },
            { label: t('statAlready'), value: totals.skipped },
            { label: t('statErrors'), value: totals.errors, tone: totals.errors > 0 ? 'error' : 'default' },
          ]}
          errorTitle={t('errorDetails')}
          errorMessages={totals.errorMessages}
        >
          <Button href="/settings/carddav">{t('backToSettings')}</Button>
          {remaining > 0 && (
            <Button variant="secondary" onClick={handleExportMore}>
              {t('exportMore')}
            </Button>
          )}
        </ResultSummary>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{t('intro')}</p>

      {error && (
        <div role="alert" className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        visibleCount={visiblePeople.length}
        totalCount={people.length}
        allVisibleSelected={areAllSelected(validSelected, visibleIds)}
        onToggleVisible={() => setSelectedIds(toggleVisible(validSelected, visibleIds))}
        stats={stats}
      />

      {visiblePeople.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted mb-3">{t('noMatches')}</p>
          <Button variant="secondary" onClick={() => setQuery('')}>
            {t('clearSearch')}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {visiblePeople.map((person) => {
            const isSelected = validSelected.has(person.id);
            const name = displayNameOf(person);
            const details = [person.organization, person.emails[0]?.email, person.phoneNumbers[0]?.number]
              .filter(Boolean)
              .join(' · ');

            return (
              <li key={person.id}>
                <label
                  className={`flex items-start gap-3 border rounded-lg p-3 min-h-11 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => setSelectedIds(toggleOne(validSelected, person.id))}
                    className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary flex-shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-foreground break-words">{name}</span>
                    {details && <span className="block text-sm text-muted break-words">{details}</span>}
                    {person.groups.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {person.groups.map((pg) => (
                          <span
                            key={pg.group.id}
                            className="px-2 py-0.5 text-xs rounded-full bg-surface-elevated text-foreground"
                          >
                            {pg.group.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {/* Stays in view while scrolling a long list, also on a phone */}
      <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-surface border-t border-border flex flex-wrap items-center gap-3">
        <Button onClick={handleExport} disabled={validSelected.size === 0}>
          {t('exportSelected', { count: validSelected.size })}
        </Button>
        <Button href="/settings/carddav" variant="secondary">
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
