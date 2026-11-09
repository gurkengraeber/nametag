'use client';

interface StepIndicatorProps {
  steps: string[];
  /** Zero based index of the current step. Earlier steps show a check mark. */
  current: number;
}

/** Numbered steps that fit a phone: equal columns, short labels under the circles. */
export default function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol className="grid mb-6" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((label, index) => {
        const isActive = index === current;
        const isCompleted = index < current;
        return (
          <li
            key={label}
            className="flex flex-col items-center text-center"
            aria-current={isActive ? 'step' : undefined}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-on-primary'
                  : isCompleted
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-surface-elevated text-muted'
              }`}
            >
              {isCompleted ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <span className={`mt-1 text-xs leading-tight px-1 ${isActive ? 'text-primary font-medium' : 'text-muted'}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
