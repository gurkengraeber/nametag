'use client';

import type { ReactNode } from 'react';

export interface SummaryStat {
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'error';
}

interface ResultSummaryProps {
  title: string;
  stats: SummaryStat[];
  errorTitle?: string;
  errorMessages?: string[];
  /** Links and buttons shown under the numbers. */
  children?: ReactNode;
}

const toneClass: Record<NonNullable<SummaryStat['tone']>, string> = {
  default: 'text-foreground',
  warning: 'text-amber-700 dark:text-amber-300',
  error: 'text-red-700 dark:text-red-300',
};

/** The "what happened" card shown after an import or export has finished. */
export default function ResultSummary({
  title,
  stats,
  errorTitle,
  errorMessages = [],
  children,
}: ResultSummaryProps) {
  return (
    <div className="space-y-4" role="status">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="p-4 bg-surface-elevated rounded-lg">
            <dt className="text-sm text-muted">{stat.label}</dt>
            <dd className={`text-2xl font-bold ${toneClass[stat.tone ?? 'default']}`}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      {errorMessages.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
          {errorTitle && <p className="font-medium mb-1">{errorTitle}</p>}
          <ul className="list-disc list-inside text-sm space-y-1 break-words">
            {errorMessages.slice(0, 20).map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {children && <div className="flex flex-wrap gap-3 pt-2">{children}</div>}
    </div>
  );
}
