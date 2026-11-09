'use client';

import { useTranslations } from 'next-intl';

interface MapSelectionBarProps {
  count: number;
  onClear: () => void;
  onAddToGroups: () => void;
  onSetRelationship: () => void;
}

// Same bar as the people list uses for bulk actions, with touch-sized buttons
// and room for the phone's home indicator.
export default function MapSelectionBar({ count, onClear, onAddToGroups, onSetRelationship }: MapSelectionBarProps) {
  const t = useTranslations('people.bulk');
  const visible = count > 0;

  const buttonClasses =
    'min-h-11 sm:min-h-0 px-3 py-1.5 text-sm font-medium text-foreground bg-surface-elevated border border-border rounded-lg hover:bg-surface-elevated/80 transition-colors';

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-[calc(theme(spacing.4)+env(safe-area-inset-bottom))]">
        <div className="bg-surface shadow-lg border border-border rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground" role="status">
              {t('selected', { count })}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-muted hover:text-foreground transition-colors"
              title={t('clearSelection')}
              aria-label={t('clearSelection')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAddToGroups} className={buttonClasses}>
              {t('addToGroups')}
            </button>
            <button type="button" onClick={onSetRelationship} className={buttonClasses}>
              {t('setRelationship')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
