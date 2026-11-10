'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface OptionCardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Optional visual shown above the label, for example a theme preview. */
  preview?: ReactNode;
}

interface OptionCardGroupProps<T extends string> {
  /** Accessible name of the whole group. */
  label: string;
  options: OptionCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Lay the cards out side by side from the sm breakpoint up. */
  columns?: 1 | 2;
}

/**
 * A group of mutually exclusive choices drawn as bordered cards, the pattern
 * the appearance settings already used. Exposed as a radio group so screen
 * readers and the keyboard treat it as one choice: Tab enters the group on the
 * selected card and the arrow keys move the choice.
 */
export default function OptionCardGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  columns = 1,
}: OptionCardGroupProps<T>) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    buttonRefs.current[next]?.focus();
  }

  // Only one card is a tab stop: the selected one, or the first when none is.
  const tabStopIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={columns === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabStopIndex ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            disabled={disabled}
            onClick={() => {
              if (!selected) onChange(option.value);
            }}
            className={`w-full text-left px-4 py-3 min-h-11 border-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
            }`}
          >
            {option.preview && <div className="mb-3">{option.preview}</div>}
            <div className="flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{option.label}</div>
                {option.description && <div className="text-sm text-muted">{option.description}</div>}
              </div>
              {selected && (
                <div className="text-primary flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
