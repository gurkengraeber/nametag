'use client';

import { useId, useState, type ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  /** Number of filled entries, shown next to the title while collapsed. */
  count?: number;
  defaultOpen?: boolean;
  /** Message shown under the title (and keeps the section open) when set. */
  error?: string;
  children: ReactNode;
}

/**
 * A titled card of the person form that can be folded away. Children stay
 * mounted while folded so no entered data or field state is lost.
 */
export default function FormSection({
  title,
  count = 0,
  defaultOpen = false,
  error,
  children,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const isOpen = open || !!error;

  return (
    <section className="border border-border rounded-lg">
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-11 text-left rounded-lg hover:bg-surface-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-lg font-semibold text-foreground">{title}</span>
            {!isOpen && count > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-muted">
                {count}
              </span>
            )}
          </span>
          <svg
            className={`w-5 h-5 flex-shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </h3>
      {error && (
        <p role="alert" className="px-4 pb-2 text-sm text-warning">
          {error}
        </p>
      )}
      <div id={contentId} hidden={!isOpen} className="px-4 pt-2 pb-4">
        {children}
      </div>
    </section>
  );
}
