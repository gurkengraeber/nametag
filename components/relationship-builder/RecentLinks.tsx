'use client';

import { useTranslations } from 'next-intl';

export interface RecentLink {
  /** Id of the primary relationship row the API returned. */
  id: string;
  summary: string;
  undoable: boolean;
}

interface RecentLinksProps {
  entries: RecentLink[];
  busyId: string | null;
  onUndo: (id: string) => void;
}

/** The last few links made in this visit, each with its own undo. */
export default function RecentLinks({ entries, busyId, onUndo }: RecentLinksProps) {
  const t = useTranslations('relationshipBuilder');
  const tToast = useTranslations('relationshipBuilder.toast');

  if (entries.length === 0) return null;

  return (
    <section className="mb-4" aria-labelledby="recent-links-title">
      <h2 id="recent-links-title" className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        {t('recent.title')}
      </h2>
      <ul className="bg-surface rounded-lg border border-border divide-y divide-border">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 px-3 py-2 min-h-11">
            <span className="flex-1 min-w-0 text-sm text-foreground break-words">{entry.summary}</span>
            {entry.undoable ? (
              <button
                type="button"
                onClick={() => onUndo(entry.id)}
                disabled={busyId === entry.id}
                aria-label={t('recent.undoAria', { summary: entry.summary })}
                className="shrink-0 px-3 py-2 min-h-11 sm:min-h-0 sm:py-1 text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                {tToast('undo')}
              </button>
            ) : (
              <span className="shrink-0 max-w-[40%] text-xs text-muted text-right">{t('recent.noUndo')}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
