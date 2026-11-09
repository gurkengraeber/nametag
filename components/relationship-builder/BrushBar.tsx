'use client';

import { useTranslations } from 'next-intl';
import type { BuilderType } from '@/lib/relationship-builder';

const QUICK_TYPES = 4;

interface BrushBarProps {
  /** Types in "recently used first" order. */
  types: BuilderType[];
  brushTypeId: string | null;
  onChange: (typeId: string | null) => void;
}

/**
 * Brush mode: pick one relationship type and every pair connected afterwards
 * gets it at once, without the picker. While it is on, the bar says so loudly.
 */
export default function BrushBar({ types, brushTypeId, onChange }: BrushBarProps) {
  const t = useTranslations('relationshipBuilder.brush');
  const active = types.find((type) => type.id === brushTypeId) ?? null;

  if (active) {
    return (
      <div
        role="status"
        className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-primary bg-primary/10"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{t('active', { type: active.label })}</p>
          <p className="text-xs text-muted mt-0.5">{t('activeHint', { type: active.label })}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="px-4 py-2 min-h-11 text-sm font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t('stop')}
        </button>
      </div>
    );
  }

  const quick = types.slice(0, QUICK_TYPES);

  return (
    <div className="mb-4 p-3 rounded-lg border border-border bg-surface">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{t('label')}</p>
          <p className="text-xs text-muted mt-0.5">{t('description')}</p>
        </div>
        <select
          value=""
          onChange={(event) => onChange(event.target.value || null)}
          aria-label={t('select')}
          className="w-full sm:w-56 px-3 py-2 min-h-11 text-base sm:text-sm border border-border rounded-lg bg-surface-elevated text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">{t('placeholder')}</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      {quick.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {quick.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => onChange(type.id)}
              className="px-3 py-2 min-h-11 sm:min-h-0 sm:py-1 text-xs font-medium rounded-full border border-border text-muted hover:text-primary hover:border-primary transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {type.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
