'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/EmptyState';
import { useSearchIndex } from '@/components/SearchIndexProvider';
import { parseCalendarDate, isYearUnknownDate } from '@/lib/date-format';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import {
  DEFAULT_RETENTION_DAYS,
  ENTITY_TYPES,
  emptyItemsByType,
  entryKey,
  filterEntries,
  formatPersonName,
  getDaysRemaining,
  getLinkedEntries,
  getPermanentDeleteUrl,
  getRestoreUrl,
  isRemovalUrgent,
  mergeEntries,
  type DeletedGroup,
  type DeletedImportantDate,
  type DeletedItem,
  type DeletedPerson,
  type DeletedRelationship,
  type DeletedRelationshipType,
  type EntityType,
  type TrashEntry,
} from '@/lib/trash';

type TabKey = 'all' | EntityType;

const TABS: TabKey[] = ['all', ...ENTITY_TYPES];

function formatCalendarDate(dateStr: string): string {
  // Stored calendar dates are UTC midnight; anchor to the encoded day so the
  // list does not show the previous day west of UTC.
  const d = parseCalendarDate(dateStr);
  if (isYearUnknownDate(dateStr)) {
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }
  return d.toLocaleDateString();
}

export default function TrashManager() {
  const t = useTranslations('settings.trash');
  const { refreshIndex } = useSearchIndex();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [itemsByType, setItemsByType] = useState<Record<EntityType, DeletedItem[]>>(emptyItemsByType);
  const [retentionDays, setRetentionDays] = useState(DEFAULT_RETENTION_DAYS);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkRestoring, setBulkRestoring] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TrashEntry | null>(null);
  const [understood, setUnderstood] = useState(false);

  // One request per type fills every tab and its count, so switching tabs never
  // waits for the network and a slow answer cannot land in the wrong tab.
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    const results = await Promise.allSettled(
      ENTITY_TYPES.map(async (type) => {
        const response = await fetch(`/api/deleted?type=${type}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data: { deleted: DeletedItem[]; retentionDays?: number } = await response.json();
        return data;
      })
    );

    const next = emptyItemsByType();
    let failed = false;
    ENTITY_TYPES.forEach((type, i) => {
      const result = results[i];
      if (result.status === 'fulfilled') {
        next[type] = result.value.deleted;
        if (typeof result.value.retentionDays === 'number') {
          setRetentionDays(result.value.retentionDays);
        }
      } else {
        failed = true;
      }
    });
    setItemsByType(next);
    setLoadFailed(failed);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const allEntries = useMemo(() => mergeEntries(itemsByType), [itemsByType]);

  const counts = useMemo(() => {
    const result: Record<TabKey, number> = { all: allEntries.length, people: 0, groups: 0, relationships: 0, relationshipTypes: 0, importantDates: 0 };
    for (const type of ENTITY_TYPES) result[type] = itemsByType[type].length;
    return result;
  }, [allEntries, itemsByType]);

  const tabEntries = useMemo(
    () => (activeTab === 'all' ? allEntries : allEntries.filter((e) => e.type === activeTab)),
    [allEntries, activeTab]
  );
  const visibleEntries = useMemo(() => filterEntries(tabEntries, query), [tabEntries, query]);
  const visibleKeys = useMemo(() => visibleEntries.map(entryKey), [visibleEntries]);
  const selectedVisible = visibleKeys.filter((key) => selected.has(key));
  const allVisibleSelected = visibleKeys.length > 0 && selectedVisible.length === visibleKeys.length;

  const removeEntries = useCallback((removed: TrashEntry[]) => {
    const removedKeys = new Set(removed.map(entryKey));
    setItemsByType((prev) => {
      const next = { ...prev };
      for (const type of ENTITY_TYPES) {
        next[type] = prev[type].filter((item) => !removedKeys.has(`${type}:${item.id}`));
      }
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      removedKeys.forEach((key) => next.delete(key));
      return next;
    });
  }, []);

  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleKeys.forEach((key) => next.delete(key));
      else visibleKeys.forEach((key) => next.add(key));
      return next;
    });
  };

  const restoreOne = async (entry: TrashEntry): Promise<boolean> => {
    try {
      const response = await fetch(getRestoreUrl(entry.type, entry.item), { method: 'POST' });
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleRestore = async (entry: TrashEntry) => {
    setActionLoading(entry.item.id);
    const ok = await restoreOne(entry);
    setActionLoading(null);
    if (!ok) {
      toast.error(t('restoreError'));
      return;
    }
    toast.success(t('restoreSuccess'));
    removeEntries(getLinkedEntries(entry, allEntries));
    if (entry.type === 'people') refreshIndex();
  };

  const handleRestoreSelected = async () => {
    const entries = visibleEntries.filter((e) => selected.has(entryKey(e)));
    if (entries.length === 0) return;
    setBulkRestoring(true);

    const restored: TrashEntry[] = [];
    let failedCount = 0;
    for (const entry of entries) {
      // Restoring a relationship also restores its inverse, which may be selected too.
      if (restored.some((r) => r.item.id === entry.item.id)) continue;
      if (await restoreOne(entry)) restored.push(...getLinkedEntries(entry, allEntries));
      else failedCount++;
    }

    setBulkRestoring(false);
    if (restored.length > 0) {
      removeEntries(restored);
      toast.success(t('restoredCount', { count: restored.length }));
      if (restored.some((r) => r.type === 'people')) refreshIndex();
    }
    if (failedCount > 0) toast.error(t('restoreSomeFailed', { count: failedCount }));
  };

  const closeConfirm = () => {
    setConfirmDelete(null);
    setUnderstood(false);
  };

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    const entry = confirmDelete;
    setActionLoading(entry.item.id);
    try {
      const response = await fetch(getPermanentDeleteUrl(entry.type, entry.item), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      toast.success(t('deleteSuccess'));
      removeEntries(getLinkedEntries(entry, allEntries));
      closeConfirm();
    } catch {
      toast.error(t('deleteError'));
    } finally {
      setActionLoading(null);
    }
  };

  const renderItemLabel = (entry: TrashEntry): string => {
    const { type, item } = entry;
    switch (type) {
      case 'people': {
        const person = item as DeletedPerson;
        if (person.displayNameOverride) return person.displayNameOverride;
        if (person.nickname) {
          return person.surname
            ? `${person.name} "${person.nickname}" ${person.surname}`
            : `${person.name} "${person.nickname}"`;
        }
        return formatPersonName(person);
      }
      case 'groups':
        return (item as DeletedGroup).name;
      case 'relationships': {
        const rel = item as DeletedRelationship;
        return t('relationshipLabel', {
          personA: formatPersonName(rel.person),
          type: rel.relationshipType?.label ?? '?',
          personB: formatPersonName(rel.relatedPerson),
        });
      }
      case 'relationshipTypes':
        return (item as DeletedRelationshipType).label;
      case 'importantDates': {
        const date = item as DeletedImportantDate;
        return t('importantDateLabel', {
          title: date.title,
          date: formatCalendarDate(date.date),
          person: formatPersonName(date.person),
        });
      }
    }
  };

  const renderColorDot = ({ type, item }: TrashEntry) => {
    let color: string | null = null;
    if (type === 'groups') color = (item as DeletedGroup).color;
    if (type === 'relationshipTypes') color = (item as DeletedRelationshipType).color;
    if (!color) return null;
    return (
      <span
        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
    );
  };

  const trashIcon = (
    <svg className="mx-auto h-12 w-12 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  const confirmName = confirmDelete ? renderItemLabel(confirmDelete) : '';

  return (
    <div>
      {/* Tabs */}
      <div className="border-b border-border mb-4 overflow-x-auto overflow-y-hidden">
        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? 'true' : undefined}
              className={`whitespace-nowrap py-3 px-1 min-h-11 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-foreground hover:border-border'
              }`}
            >
              {t(`tabs.${tab}`)}
              {counts[tab] > 0 && (
                <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === tab
                    ? 'bg-primary/10 text-primary'
                    : 'bg-surface-elevated text-muted'
                }`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {loadFailed && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3 bg-warning/10 border border-warning/30 text-warning rounded text-sm">
              <span>{t('loadError')}</span>
              <Button variant="secondary" size="sm" onClick={loadAll}>
                {t('retry')}
              </Button>
            </div>
          )}

          {tabEntries.length > 0 && (
            <div className="mb-3">
              <label htmlFor="trash-search" className="sr-only">
                {t('searchLabel')}
              </label>
              <input
                id="trash-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full min-h-11 sm:min-h-0 px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {allEntries.length === 0 && !loadFailed ? (
            <EmptyState
              icon={trashIcon}
              title={t('emptyTitle')}
              description={t('emptyDescription', { days: retentionDays })}
            />
          ) : tabEntries.length === 0 ? (
            !loadFailed && activeTab !== 'all' && (
              <div className="text-center py-12">
                {trashIcon}
                <p className="mt-4 text-muted">
                  {t('empty', { type: t(`emptyTypes.${activeTab}`) })}
                </p>
              </div>
            )
          ) : visibleEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted">{t('noMatches', { query: query.trim() })}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setQuery('')}>
                {t('clearSearch')}
              </Button>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-3 min-h-11 text-sm text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="h-5 w-5 accent-primary"
                />
                {t('selectAll', { count: visibleEntries.length })}
              </label>

              <ul className="divide-y divide-border">
                {visibleEntries.map((entry) => {
                  const key = entryKey(entry);
                  const label = renderItemLabel(entry);
                  const days = getDaysRemaining(entry.item.deletedAt, retentionDays);
                  const busy = actionLoading === entry.item.id || bulkRestoring;
                  return (
                    <li key={key} className="py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <label className="flex items-center justify-center h-11 w-6 -my-2 flex-shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onChange={() => toggleSelected(key)}
                            aria-label={t('selectItem', { name: label })}
                            className="h-5 w-5 accent-primary"
                          />
                        </label>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {renderColorDot(entry)}
                            <span className="text-foreground break-words min-w-0">{label}</span>
                          </div>
                          <p className={`text-xs mt-0.5 ${isRemovalUrgent(days) ? 'text-warning' : 'text-muted'}`}>
                            {activeTab === 'all' && (
                              <span className="text-muted">{t(`itemTypes.${entry.type}`)} · </span>
                            )}
                            {days < 1 ? t('removalSoon') : t('removalIn', { days })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 sm:mt-0 pl-9 sm:pl-0 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                          onClick={() => handleRestore(entry)}
                          disabled={busy}
                        >
                          {actionLoading === entry.item.id ? t('restoring') : t('restore')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setConfirmDelete(entry)}
                          disabled={busy}
                        >
                          {t('permanentDelete')}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {selectedVisible.length > 0 && (
                <div className="sticky bottom-3 mt-4 flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-elevated border border-border rounded-lg shadow-lg pb-[calc(theme(spacing.3)+env(safe-area-inset-bottom))]">
                  <span className="text-sm text-foreground" aria-live="polite">
                    {t('selectedCount', { count: selectedVisible.length })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelected(new Set())}
                      disabled={bulkRestoring}
                    >
                      {t('clearSelection')}
                    </Button>
                    <Button size="sm" onClick={handleRestoreSelected} disabled={bulkRestoring}>
                      {bulkRestoring ? t('restoring') : t('restoreSelected')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Confirmation modal */}
      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={closeConfirm}
        onConfirm={handlePermanentDelete}
        title={t('confirmDelete.title')}
        confirmText={t('confirmDelete.confirm')}
        cancelText={t('confirmDelete.cancel')}
        isLoading={!!actionLoading}
        loadingText={t('deleting')}
        confirmDisabled={!understood}
        variant="danger"
      >
        <p className="text-foreground font-medium break-words mb-2">{confirmName}</p>
        <p className="text-muted">
          {confirmDelete?.type === 'people'
            ? t('confirmDelete.messagePerson')
            : t('confirmDelete.message')}
        </p>
        <label className="mt-4 flex items-start gap-3 min-h-11 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-primary"
          />
          {t('confirmDelete.understand')}
        </label>
      </ConfirmationModal>
    </div>
  );
}
