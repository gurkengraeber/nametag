'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { SelectionStats } from '@/lib/carddav-ui/selection';

interface ListToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Number of rows currently shown, after the search and filters. */
  visibleCount: number;
  /** Number of rows before any search or filter. */
  totalCount: number;
  allVisibleSelected: boolean;
  onToggleVisible: () => void;
  stats: SelectionStats;
  /** Filter buttons shown under the search field. */
  children?: ReactNode;
}

/**
 * Search, "select all shown" and the selection counter used above the
 * CardDAV import and export lists. "Select all" only ever acts on the rows
 * that are visible, so a search narrows what gets picked.
 */
export default function ListToolbar({
  query,
  onQueryChange,
  visibleCount,
  totalCount,
  allVisibleSelected,
  onToggleVisible,
  stats,
  children,
}: ListToolbarProps) {
  const t = useTranslations('settings.carddav.list');
  const isFiltered = visibleCount !== totalCount;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary text-base sm:text-sm"
      />

      {children}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pb-3 border-b border-border">
        <label className="flex items-center gap-3 cursor-pointer min-h-11 sm:min-h-0">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            disabled={visibleCount === 0}
            onChange={onToggleVisible}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="font-medium text-foreground">
            {allVisibleSelected
              ? t('deselectVisible', { count: visibleCount })
              : t('selectVisible', { count: visibleCount })}
          </span>
        </label>
        <p className="text-sm text-muted" aria-live="polite">
          {isFiltered && <span>{t('showing', { shown: visibleCount, total: totalCount })}{' · '}</span>}
          {t('selectedCount', { count: stats.total })}
          {stats.hiddenSelected > 0 && (
            <span>{' · '}{t('selectedHidden', { count: stats.hiddenSelected })}</span>
          )}
        </p>
      </div>
    </div>
  );
}
