'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export type MapSelectMode = 'off' | 'tap' | 'frame';

interface MapToolbarProps {
  /** Number of people shown on the map with the current filters */
  peopleCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  selectMode: MapSelectMode;
  onSelectModeChange: (mode: MapSelectMode) => void;
  onSelectAllShown: () => void;
  /** Whether the people list drawer is open */
  listOpen: boolean;
  onToggleList: () => void;
  /** People without a place yet, shown as a hint on the list button */
  unplacedCount: number;
  /** The map itself is not rendered (no markers or no WebGL), so map-only tools are hidden */
  mapAvailable: boolean;
}

export default function MapToolbar({
  peopleCount,
  hasActiveFilters,
  onClearFilters,
  selectMode,
  onSelectModeChange,
  onSelectAllShown,
  listOpen,
  onToggleList,
  unplacedCount,
  mapAvailable,
}: MapToolbarProps) {
  const t = useTranslations('map');
  const selecting = selectMode !== 'off';

  return (
    <div className="px-4 py-2 bg-surface border-b border-border">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted mr-auto" role="status">
          {t('peopleShown', { count: peopleCount })}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="min-h-11 sm:min-h-0 px-3 py-2 text-sm text-primary hover:text-primary-dark transition-colors whitespace-nowrap"
          >
            {t('clearFilters')}
          </button>
        )}
        {mapAvailable && (
          <Button
            variant={selecting ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={selecting}
            onClick={() => onSelectModeChange(selecting ? 'off' : 'tap')}
          >
            {selecting ? t('selectDone') : t('select')}
          </Button>
        )}
        <Button variant="secondary" size="sm" aria-expanded={listOpen} onClick={onToggleList}>
          {t('openList')}
          {unplacedCount > 0 && (
            <span className="ml-2 px-1.5 rounded-full bg-surface-elevated text-xs text-muted">{unplacedCount}</span>
          )}
        </Button>
      </div>

      {selecting && mapAvailable && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border overflow-hidden" role="group" aria-label={t('select')}>
            {(['tap', 'frame'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={selectMode === mode}
                onClick={() => onSelectModeChange(mode)}
                className={`min-h-11 sm:min-h-0 px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectMode === mode
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface text-muted hover:bg-surface-elevated'
                }`}
              >
                {mode === 'tap' ? t('selectTap') : t('selectFrame')}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={onSelectAllShown}>
            {t('selectAllShown')}
          </Button>
          <span className="text-xs text-muted basis-full sm:basis-auto">
            {selectMode === 'tap' ? t('selectTapHint') : t('selectFrameHint')}
          </span>
        </div>
      )}
    </div>
  );
}
