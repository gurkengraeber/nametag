'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/date-format';

interface QuickUpdate {
  lastContact?: string | null;
  relationshipToUserId?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface QuickEditRelationshipType {
  id: string;
  label: string;
  color: string | null;
}

const inputClass =
  'min-w-0 px-2 py-1 text-sm text-foreground bg-transparent border border-transparent rounded ' +
  'hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

/** Dates are stored as UTC midnight, so the ISO string holds the calendar day. */
export function toDateInputValue(value: Date | string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function useQuickUpdate(personId: string) {
  const t = useTranslations('people.quickEdit');
  const save = useCallback(
    async (update: QuickUpdate): Promise<boolean> => {
      try {
        const response = await fetch(`/api/people/${personId}/quick-update`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        });
        if (!response.ok) {
          toast.error(t('saveError'));
          return false;
        }
        return true;
      } catch {
        toast.error(t('saveError'));
        return false;
      }
    },
    [personId, t],
  );

  return { save };
}

export function RelationshipCell({
  personId,
  value,
  types,
  onSaved,
}: {
  personId: string;
  value: string | null;
  types: QuickEditRelationshipType[];
  onSaved?: () => void;
}) {
  const t = useTranslations('people');
  const { save } = useQuickUpdate(personId);
  const [current, setCurrent] = useState(value ?? '');

  const selected = types.find((type) => type.id === current);

  const handleChange = async (next: string) => {
    const previous = current;
    setCurrent(next);
    const ok = await save({ relationshipToUserId: next || null });
    if (ok) onSaved?.();
    else setCurrent(previous);
  };

  return (
    <select
      value={current}
      onChange={(event) => handleChange(event.target.value)}
      aria-label={t('relationshipToUser')}
      className={`${inputClass} w-full font-medium cursor-pointer`}
      style={selected?.color ? { color: selected.color } : undefined}
    >
      <option value="">{t('indirect')}</option>
      {types.map((type) => (
        <option key={type.id} value={type.id}>
          {type.label}
        </option>
      ))}
    </select>
  );
}

export function LastContactCell({
  personId,
  value,
}: {
  personId: string;
  /** Calendar day as "YYYY-MM-DD", or an empty string. */
  value: string;
}) {
  const tPicker = useTranslations('datePicker');
  const tPeople = useTranslations('people');
  const { save } = useQuickUpdate(personId);
  const [current, setCurrent] = useState(value);

  const update = async (next: string) => {
    if (next === current) return;
    const previous = current;
    setCurrent(next);
    const ok = await save({ lastContact: next || null });
    if (!ok) setCurrent(previous);
  };

  const today = getLocalDateString();

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={current}
        max={today}
        onChange={(event) => update(event.target.value)}
        aria-label={tPeople('lastContact')}
        className={inputClass}
      />
      {current !== today && (
        <button
          type="button"
            onClick={() => update(today)}
          className="px-2 py-1 text-xs font-medium text-primary bg-primary/10 rounded hover:bg-primary/20 transition-colors"
        >
          {tPicker('today')}
        </button>
      )}
    </div>
  );
}

export function LocationCell({
  personId,
  city,
  country,
}: {
  personId: string;
  city: string | null;
  country: string | null;
}) {
  const t = useTranslations('people.quickEdit');
  const { save } = useQuickUpdate(personId);
  const [cityValue, setCityValue] = useState(city ?? '');
  const [countryValue, setCountryValue] = useState(country ?? '');
  const saved = useRef({ city: city ?? '', country: country ?? '' });

  const commit = async (field: 'city' | 'country', value: string) => {
    const trimmed = value.trim();
    if (trimmed === saved.current[field]) return;
    const previous = saved.current[field];
    saved.current[field] = trimmed;
    const ok = await save({ [field]: trimmed || null });
    if (!ok) {
      saved.current[field] = previous;
      if (field === 'city') setCityValue(previous);
      else setCountryValue(previous);
    }
  };

  const commitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={cityValue}
        maxLength={100}
        placeholder={t('cityPlaceholder')}
        aria-label={t('cityPlaceholder')}
        onChange={(event) => setCityValue(event.target.value)}
        onBlur={(event) => commit('city', event.target.value)}
        onKeyDown={commitOnEnter}
        className={`${inputClass} w-32`}
      />
      <input
        type="text"
        value={countryValue}
        maxLength={100}
        placeholder={t('countryPlaceholder')}
        aria-label={t('countryPlaceholder')}
        onChange={(event) => setCountryValue(event.target.value)}
        onBlur={(event) => commit('country', event.target.value)}
        onKeyDown={commitOnEnter}
        className={`${inputClass} w-28`}
      />
    </div>
  );
}
