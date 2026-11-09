'use client';

import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { searchGraphPeople } from './graph/search-people';
import type { RawGraphPerson } from './graph/bubble-composition';

interface GraphSearchProps {
  people: RawGraphPerson[];
  /** A hit was chosen: the graph centers on this person. */
  onSelect: (personId: string) => void;
  /** The field was emptied: the highlight goes away. */
  onClear: () => void;
}

export default function GraphSearch({ people, onSelect, onClear }: GraphSearchProps) {
  const t = useTranslations('dashboard.graph.search');
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchGraphPeople(people, query), [people, query]);
  const hasQuery = query.trim().length > 0;

  const choose = (person: RawGraphPerson) => {
    setQuery(person.label);
    setOpen(false);
    onSelect(person.id);
  };

  const clear = () => {
    setQuery('');
    setOpen(false);
    onClear();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      const person = results[activeIndex] ?? results[0];
      if (person) {
        event.preventDefault();
        choose(person);
      }
    } else if (event.key === 'Escape') {
      // Escape first closes the list, then empties the field. It must not
      // reach the full-screen handler while the field is in use.
      if (open || hasQuery) event.stopPropagation();
      if (open) setOpen(false);
      else if (hasQuery) clear();
    }
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="text"
        role="combobox"
        aria-expanded={open && hasQuery}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={t('ariaLabel')}
        placeholder={t('placeholder')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
          if (!event.target.value.trim()) onClear();
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full min-h-11 sm:min-h-0 sm:h-9 pl-9 pr-10 text-sm rounded-lg border border-border bg-surface text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      />
      {hasQuery && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-0 top-0 inline-flex h-full w-11 sm:w-9 items-center justify-center text-muted hover:text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t('clear')}
          title={t('clear')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      {open && hasQuery && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-10 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">{t('noResults')}</li>
          ) : (
            results.map((person, index) => (
              <li key={person.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onClick={() => choose(person)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full min-h-11 px-3 text-left text-sm text-foreground truncate transition-colors ${
                    index === activeIndex ? 'bg-surface-elevated' : 'hover:bg-surface-elevated'
                  }`}
                >
                  {person.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
