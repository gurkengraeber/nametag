'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import PillSelector from '@/components/PillSelector';
import { formatFullName, formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';
import { getRangePresets, type RangePresetId } from '@/lib/journal';

interface PersonOption {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  displayNameOverride?: string | null;
}

interface PillPerson {
  id: string;
  label: string;
}

interface JournalFiltersProps {
  people: PersonOption[];
  currentPersonIds: string[];
  currentSearch?: string;
  /** Inclusive first and last day of the time range, as YYYY-MM-DD. */
  currentFrom?: string;
  currentTo?: string;
  nameOrder: 'WESTERN' | 'EASTERN';
  nameDisplayFormat?: NameDisplayFormat;
}

const SEARCH_DELAY_MS = 350;

const PRESET_LABEL_KEYS: Record<RangePresetId, 'rangeWeek' | 'rangeMonth' | 'rangeYear'> = {
  week: 'rangeWeek',
  month: 'rangeMonth',
  year: 'rangeYear',
};

interface FilterState {
  personIds: string[];
  search?: string;
  from?: string;
  to?: string;
}

export default function JournalFilters({
  people,
  currentPersonIds,
  currentSearch,
  currentFrom,
  currentTo,
  nameOrder,
  nameDisplayFormat,
}: JournalFiltersProps) {
  const t = useTranslations('journal');
  const tf = useTranslations('journal.filters');
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(currentSearch ?? '');

  const pillPeople: PillPerson[] = useMemo(
    () => people.map((p) => ({ id: p.id, label: formatGraphName(p, nameOrder, nameDisplayFormat) })),
    [people, nameOrder, nameDisplayFormat],
  );

  const dropdownPeople: PillPerson[] = useMemo(
    () => people.map((p) => ({ id: p.id, label: formatFullName(p, nameOrder) })),
    [people, nameOrder],
  );

  const selectedPeople = useMemo(
    () =>
      currentPersonIds
        .map((id) => pillPeople.find((p) => p.id === id))
        .filter((p): p is PillPerson => p !== undefined),
    [currentPersonIds, pillPeople],
  );

  function navigate(next: FilterState, replace = false) {
    const url = new URL('/journal', window.location.origin);
    if (next.personIds.length > 0) url.searchParams.set('person', next.personIds.join(','));
    if (next.search) url.searchParams.set('q', next.search);
    if (next.from) url.searchParams.set('from', next.from);
    if (next.to) url.searchParams.set('to', next.to);
    // Entries with a time of day are compared as days of the viewer's zone.
    if (next.from || next.to) url.searchParams.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
    const href = url.pathname + url.search;
    if (replace) {
      router.replace(href);
    } else {
      router.push(href);
    }
  }

  const current: FilterState = {
    personIds: selectedPeople.map((p) => p.id),
    search: currentSearch,
    from: currentFrom,
    to: currentTo,
  };

  // Search while typing, without piling up history entries.
  useEffect(() => {
    const wanted = query.trim();
    if (wanted === (currentSearch ?? '')) return;
    const timer = setTimeout(() => {
      navigate({ ...current, search: wanted || undefined }, true);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // `current` is rebuilt every render from the props listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, currentSearch, currentPersonIds, currentFrom, currentTo]);

  // Follow the address bar (back button, "clear filters") unless the user is typing.
  useEffect(() => {
    if (document.activeElement !== searchRef.current) {
      setQuery(currentSearch ?? '');
    }
  }, [currentSearch]);

  const presets = useMemo(() => getRangePresets(new Date()), []);
  const activePreset = presets.find((p) => p.from === currentFrom && p.to === currentTo);
  const hasRange = Boolean(currentFrom || currentTo);

  function customRangeLabel(): string {
    if (currentFrom && currentTo) return tf('rangeCustom', { from: currentFrom, to: currentTo });
    if (currentFrom) return tf('rangeFrom', { date: currentFrom });
    return tf('rangeTo', { date: currentTo ?? '' });
  }

  function handleAddPerson(person: PillPerson) {
    navigate({ ...current, personIds: [...current.personIds, person.id] });
  }

  function handleRemovePerson(personId: string) {
    navigate({ ...current, personIds: current.personIds.filter((id) => id !== personId) });
  }

  const chipBase =
    'inline-flex items-center justify-center px-3 py-1.5 min-h-11 sm:min-h-0 text-sm rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary';
  const chipOn = 'border-primary bg-primary/10 text-primary';
  const chipOff = 'border-border text-muted hover:text-foreground hover:border-primary/60';

  return (
    <div className="space-y-3 mb-6">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ ...current, search: query.trim() || undefined }, true);
        }}
      >
        <input
          ref={searchRef}
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary text-base sm:text-sm"
        />
      </form>
      <PillSelector
        selectedItems={selectedPeople}
        availableItems={dropdownPeople.filter((p) => !selectedPeople.some((s) => s.id === p.id))}
        onAdd={handleAddPerson}
        onRemove={handleRemovePerson}
        placeholder={t('filterByPerson')}
        showAllOnFocus
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label={tf('rangeLabel')}>
        <button
          type="button"
          aria-pressed={!hasRange}
          onClick={() => navigate({ ...current, from: undefined, to: undefined })}
          className={`${chipBase} ${!hasRange ? chipOn : chipOff}`}
        >
          {tf('rangeAny')}
        </button>
        {presets.map((preset) => {
          const active = activePreset?.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() =>
                navigate(
                  active
                    ? { ...current, from: undefined, to: undefined }
                    : { ...current, from: preset.from, to: preset.to },
                )
              }
              className={`${chipBase} ${active ? chipOn : chipOff}`}
            >
              {tf(PRESET_LABEL_KEYS[preset.id])}
            </button>
          );
        })}
        {hasRange && !activePreset && (
          <button
            type="button"
            aria-pressed="true"
            onClick={() => navigate({ ...current, from: undefined, to: undefined })}
            className={`${chipBase} ${chipOn}`}
          >
            {customRangeLabel()}
          </button>
        )}
      </div>
    </div>
  );
}
