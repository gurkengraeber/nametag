'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseVCard as vCardToPerson } from '@/lib/carddav/vcard-parser';
import CompactContactRow from './CompactContactRow';
import GroupsSelector from './GroupsSelector';
import { Button } from '@/components/ui/Button';
import BatchProgress from '@/components/carddav/BatchProgress';
import ListToolbar from '@/components/carddav/ListToolbar';
import ResultSummary from '@/components/carddav/ResultSummary';
import StepIndicator from '@/components/carddav/StepIndicator';
import { useSearchIndex } from '@/components/SearchIndexProvider';
import {
  IMPORT_BATCH_SIZE,
  addImportResult,
  buildImportBody,
  emptyImportTotals,
  type ImportTotals,
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

interface PendingImport {
  id: string;
  uid: string;
  href: string;
  vCardData: string;
  displayName: string;
  discoveredAt: Date;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface RelationshipType {
  id: string;
  label: string;
  color: string | null;
}

interface ImportContactsListProps {
  pendingImports: PendingImport[];
  groups: Group[];
  relationshipTypes: RelationshipType[];
  isFileImport?: boolean;
  existingUids?: string[];
}

type Step = 'choose' | 'assign' | 'importing' | 'done';
type Filter = 'all' | 'new' | 'existing';

class ImportRequestError extends Error {}

export default function ImportContactsList({
  pendingImports,
  groups,
  relationshipTypes,
  isFileImport = false,
  existingUids = [],
}: ImportContactsListProps) {
  const t = useTranslations('settings.carddav.import');
  const router = useRouter();
  const { refreshIndex } = useSearchIndex();
  const [step, setStep] = useState<Step>('choose');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [perContactGroups, setPerContactGroups] = useState<Map<string, string[]>>(new Map());
  const [availableGroups, setAvailableGroups] = useState<Group[]>(groups);
  const [globalRelationshipTypeId, setGlobalRelationshipTypeId] = useState<string>('');
  const [perContactRelationshipTypeId, setPerContactRelationshipTypeId] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [totals, setTotals] = useState<ImportTotals>(emptyImportTotals());
  const [notProcessed, setNotProcessed] = useState(0);

  const existingUidSet = useMemo(() => new Set(existingUids), [existingUids]);
  const [updateExistingIds, setUpdateExistingIds] = useState<Set<string>>(new Set());

  const parsedVCards = useMemo(
    () =>
      new Map(
        pendingImports.map((pi) => {
          try {
            return [pi.id, vCardToPerson(pi.vCardData)] as const;
          } catch {
            return [pi.id, null] as const;
          }
        })
      ),
    [pendingImports]
  );

  const isExistingContact = (pi: PendingImport) => existingUidSet.has(pi.uid);

  // The search and the filter decide which rows are shown; "select all" only
  // ever acts on these.
  const visibleImports = useMemo(() => {
    const byFilter = pendingImports.filter((pi) => {
      if (filter === 'new') return !existingUidSet.has(pi.uid);
      if (filter === 'existing') return existingUidSet.has(pi.uid);
      return true;
    });
    return filterBySearch(byFilter, query, (pi) => {
      const parsed = parsedVCards.get(pi.id);
      return [
        pi.displayName,
        parsed?.name,
        parsed?.surname,
        parsed?.nickname,
        parsed?.organization,
        ...(parsed?.emails ?? []).map((e) => e.email),
        ...(parsed?.phoneNumbers ?? []).map((n) => n.number),
      ];
    });
  }, [pendingImports, filter, query, existingUidSet, parsedVCards]);
  const visibleIds = useMemo(() => visibleImports.map((pi) => pi.id), [visibleImports]);
  const validSelected = useMemo(
    () => pruneSelection(selectedIds, pendingImports.map((pi) => pi.id)),
    [selectedIds, pendingImports]
  );
  const stats = selectionStats(validSelected, visibleIds);

  const selectedImports = pendingImports.filter((pi) => validSelected.has(pi.id));
  const selectedExistingCount = selectedImports.filter(isExistingContact).length;
  const selectedNewCount = selectedImports.length - selectedExistingCount;
  const allSelectedExistingUpdate =
    selectedExistingCount > 0 &&
    selectedImports.filter(isExistingContact).every((pi) => updateExistingIds.has(pi.id));

  const handleGroupCreated = (group: Group) => {
    setAvailableGroups((prev) => {
      if (prev.some((g) => g.id === group.id)) return prev;
      return [...prev, group];
    });
  };

  const handlePerContactGroupsChange = (contactId: string, groupIds: string[]) => {
    setPerContactGroups((prev) => {
      const newMap = new Map(prev);
      if (groupIds.length === 0) {
        newMap.delete(contactId);
      } else {
        newMap.set(contactId, groupIds);
      }
      return newMap;
    });
  };

  const handleToggleUpdateExisting = (id: string) => {
    setUpdateExistingIds((prev) => toggleOne(prev, id));
  };

  const handleToggleUpdateAll = () => {
    setUpdateExistingIds((prev) => {
      const next = new Set(prev);
      for (const pi of selectedImports.filter(isExistingContact)) {
        if (allSelectedExistingUpdate) next.delete(pi.id);
        else next.add(pi.id);
      }
      return next;
    });
  };

  const handlePerContactRelationshipChange = (contactId: string, relationshipTypeId: string) => {
    setPerContactRelationshipTypeId((prev) => {
      const newMap = new Map(prev);
      if (relationshipTypeId === '') {
        newMap.delete(contactId);
      } else {
        newMap.set(contactId, relationshipTypeId);
      }
      return newMap;
    });
  };

  // Detect unsaved changes
  const hasUnsavedChanges =
    step !== 'done' &&
    (validSelected.size > 0 ||
      selectedGroupIds.length > 0 ||
      perContactGroups.size > 0 ||
      globalRelationshipTypeId !== '' ||
      perContactRelationshipTypeId.size > 0 ||
      updateExistingIds.size > 0);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const leaveUrl = isFileImport ? '/people' : '/settings/carddav';

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm(t('confirmLeave'))) {
        router.push(leaveUrl);
      }
    } else {
      router.push(leaveUrl);
    }
  };

  const handleContinue = () => {
    if (validSelected.size === 0) {
      setError(t('noContactsSelected'));
      return;
    }
    setError(null);
    setStep('assign');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImport = async () => {
    const ids = pendingImports.filter((pi) => validSelected.has(pi.id)).map((pi) => pi.id);
    if (ids.length === 0) {
      setError(t('noContactsSelected'));
      setStep('choose');
      return;
    }

    setStep('importing');
    setError(null);
    setTotals(emptyImportTotals());
    setNotProcessed(0);

    let running = emptyImportTotals();
    const run = await runInBatches(
      ids,
      IMPORT_BATCH_SIZE,
      async (batch) => {
        const response = await fetch('/api/carddav/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            buildImportBody(batch, {
              globalGroupIds: selectedGroupIds,
              globalRelationshipTypeId,
              perContactGroups,
              perContactRelationshipTypeId,
              updateExistingIds,
            })
          ),
        });
        const data: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          const body = (data ?? {}) as { error?: string; code?: string; params?: { available?: number; requested?: number } };
          if (response.status === 403 && body.code === 'plan_limit_reached') {
            throw new ImportRequestError(
              t('importLimitExceeded', {
                available: body.params?.available ?? 0,
                requested: body.params?.requested ?? 0,
              })
            );
          }
          throw new ImportRequestError(body.error || t('importFailed'));
        }
        running = addImportResult(running, data);
        setTotals(running);
        return data;
      },
      (done, total) => setProgress({ done, total })
    );

    refreshIndex();
    setNotProcessed(ids.length - run.processed);
    if (run.error) {
      setError(run.error instanceof Error ? run.error.message : t('importFailed'));
    }
    setStep('done');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChooseMore = () => {
    setSelectedIds(new Set());
    setError(null);
    setStep('choose');
    router.refresh();
  };

  const stepLabels = [
    isFileImport ? t('stepFile') : t('stepConnect'),
    t('stepChoose'),
    t('stepAssign'),
    t('stepDone'),
  ];
  const stepIndex = step === 'choose' ? 1 : step === 'assign' ? 2 : step === 'importing' ? 2 : 3;

  const filterButtons: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: t('filterAll') },
    { key: 'new', label: t('filterNew') },
    { key: 'existing', label: t('filterExisting') },
  ];

  const header = <StepIndicator steps={stepLabels} current={stepIndex} />;

  if (step === 'importing') {
    return (
      <div>
        {header}
        <BatchProgress
          done={progress.done}
          total={progress.total}
          label={t('importing')}
          detail={t('progress', { done: progress.done, total: progress.total })}
        />
      </div>
    );
  }

  if (step === 'done') {
    const remaining = pendingImports.length - totals.imported - totals.updated - totals.skipped;
    return (
      <div>
        {header}
        {error && (
          <div role="alert" className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
            <p>{error}</p>
            {notProcessed > 0 && <p className="text-sm mt-1">{t('notProcessed', { count: notProcessed })}</p>}
          </div>
        )}
        <ResultSummary
          title={t('importComplete')}
          stats={[
            { label: t('statImported'), value: totals.imported },
            { label: t('statUpdated'), value: totals.updated },
            { label: t('statSkipped'), value: totals.skipped, tone: totals.skipped > 0 ? 'warning' : 'default' },
            { label: t('statErrors'), value: totals.errors, tone: totals.errors > 0 ? 'error' : 'default' },
          ]}
          errorTitle={t('errorDetails')}
          errorMessages={totals.errorMessages}
        >
          <Button href="/people">{t('openPeople')}</Button>
          {!isFileImport && (
            <Button href="/settings/carddav" variant="secondary">
              {t('backToSettings')}
            </Button>
          )}
          {remaining > 0 && (
            <Button variant="secondary" onClick={handleChooseMore}>
              {t('chooseMore')}
            </Button>
          )}
        </ResultSummary>
      </div>
    );
  }

  if (step === 'assign') {
    return (
      <div className="space-y-6">
        {header}

        <div className="p-4 bg-surface-elevated rounded-lg">
          <p className="font-medium text-foreground">
            {t('reviewTitle', { count: validSelected.size })}
          </p>
          <p className="text-sm text-muted mt-1">
            {t('reviewBreakdown', { newCount: selectedNewCount, existingCount: selectedExistingCount })}
          </p>
        </div>

        {/* Global Settings: Groups + Relationship side by side */}
        <div className={`grid gap-4 ${relationshipTypes.length > 0 ? 'md:grid-cols-2' : ''}`}>
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-semibold text-foreground mb-3">
              {t('assignToGroups')}
            </h3>
            <p className="text-sm text-muted mb-3">
              {t('assignToGroupsDescription')}
            </p>
            <GroupsSelector
              availableGroups={availableGroups}
              selectedGroupIds={selectedGroupIds}
              onChange={setSelectedGroupIds}
              onGroupCreated={handleGroupCreated}
            />
          </div>

          {relationshipTypes.length > 0 && (
            <div className="border border-border rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-3">
                {t('assignRelationship')}
              </h3>
              <p className="text-sm text-muted mb-3">
                {t('assignRelationshipDescription')}
              </p>
              <select
                value={globalRelationshipTypeId}
                onChange={(e) => setGlobalRelationshipTypeId(e.target.value)}
                aria-label={t('assignRelationship')}
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-base sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">{t('noRelationship')}</option>
                {relationshipTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted mt-2">
                {t('relationshipPrecedenceHelp')}
              </p>
            </div>
          )}
        </div>

        {selectedExistingCount > 0 && (
          <div className="border border-border rounded-lg p-4 space-y-2">
            <label className="flex items-start gap-3 min-h-11 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelectedExistingUpdate}
                onChange={handleToggleUpdateAll}
                className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary flex-shrink-0"
              />
              <span className="text-sm font-medium text-foreground">
                {t('updateAllExisting', { count: selectedExistingCount })}
              </span>
            </label>
            <p className="text-xs text-muted">{t('existingNote')}</p>
          </div>
        )}

        <p className="text-sm text-muted">{t('perContactHint')}</p>

        {error && (
          <div role="alert" className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-surface border-t border-border flex flex-wrap gap-3">
          <Button onClick={handleImport}>
            {t('importSelected', { count: validSelected.size })}
          </Button>
          <Button variant="secondary" onClick={() => setStep('choose')}>
            {t('back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {error && (
        <div role="alert" className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        visibleCount={visibleImports.length}
        totalCount={pendingImports.length}
        allVisibleSelected={areAllSelected(validSelected, visibleIds)}
        onToggleVisible={() => setSelectedIds(toggleVisible(validSelected, visibleIds))}
        stats={stats}
      >
        {existingUids.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('filterLabel')}>
            {filterButtons.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`px-3 py-1.5 min-h-11 sm:min-h-0 rounded-full text-sm border transition-colors ${
                  filter === key
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted hover:bg-surface-elevated'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </ListToolbar>

      {visibleImports.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted mb-3">{t('noMatches')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            {t('clearSearch')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleImports.map((pendingImport) => {
            const parsed = parsedVCards.get(pendingImport.id) ?? null;
            const isSelected = validSelected.has(pendingImport.id);
            const contactGroupIds = perContactGroups.get(pendingImport.id) || [];

            const isExisting = existingUidSet.has(pendingImport.uid);
            const willUpdate = updateExistingIds.has(pendingImport.id);

            return (
              <CompactContactRow
                key={pendingImport.id}
                pendingImport={pendingImport}
                isSelected={isSelected}
                onToggle={(id) => setSelectedIds(toggleOne(validSelected, id))}
                availableGroups={availableGroups}
                selectedGroupIds={contactGroupIds}
                onGroupsChange={handlePerContactGroupsChange}
                onGroupCreated={handleGroupCreated}
                parsedData={parsed}
                relationshipTypes={relationshipTypes}
                selectedRelationshipTypeId={perContactRelationshipTypeId.get(pendingImport.id) || ''}
                onRelationshipChange={handlePerContactRelationshipChange}
                isExisting={isExisting}
                willUpdate={willUpdate}
                onToggleUpdate={handleToggleUpdateExisting}
              />
            );
          })}
        </div>
      )}

      {/* Stays in view while scrolling a long list, also on a phone */}
      <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-surface border-t border-border flex flex-wrap gap-3">
        <Button onClick={handleContinue} disabled={validSelected.size === 0}>
          {t('continueWith', { count: validSelected.size })}
        </Button>
        <Button variant="secondary" onClick={handleCancel}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
