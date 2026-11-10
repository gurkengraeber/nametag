'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/date-format';
import { countries } from '@/lib/countries';

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

/**
 * One field that is saved as soon as it changes.
 *
 * - Saves run one after another, so a quick second change cannot be overtaken by the first.
 * - A failed save shows the last value the server confirmed again, unless a newer change is already on its way.
 * - A new value from the server (after a refresh) replaces what is shown.
 */
function useQuickField(personId: string, field: keyof QuickUpdate, serverValue: string) {
  const t = useTranslations('people.quickEdit');
  const [value, setValue] = useState(serverValue);
  const [seenServerValue, setSeenServerValue] = useState(serverValue);
  const confirmed = useRef(serverValue);
  const requested = useRef(serverValue);
  const latest = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  if (serverValue !== seenServerValue) {
    setSeenServerValue(serverValue);
    setValue(serverValue);
  }

  useEffect(() => {
    confirmed.current = serverValue;
    requested.current = serverValue;
  }, [serverValue]);

  const save = useCallback(
    async (next: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/people/${personId}/quick-update`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: next || null }),
        });
        if (response.ok) return true;
      } catch {
        // Reported below, like a rejected request.
      }
      toast.error(t('saveError'));
      return false;
    },
    [personId, field, t],
  );

  /** Shows and saves `next`. Resolves to whether the server has it. */
  const commit = async (next: string): Promise<boolean> => {
    setValue(next);
    if (next === requested.current) return true;
    requested.current = next;
    const mine = ++latest.current;
    const run = queue.current.then(() => save(next));
    queue.current = run;
    const ok = await run;
    if (ok) {
      confirmed.current = next;
    } else if (mine === latest.current) {
      requested.current = confirmed.current;
      setValue(confirmed.current);
    }
    return ok;
  };

  return { value, edit: setValue, commit };
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
  const { value: current, commit } = useQuickField(personId, 'relationshipToUserId', value ?? '');

  const selected = types.find((type) => type.id === current);

  const handleChange = async (next: string) => {
    if (await commit(next)) onSaved?.();
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
  const { value: current, edit, commit } = useQuickField(personId, 'lastContact', value);

  const update = (next: string) => {
    // While a year is typed the field passes through dates like 0002-11-09, which must not be saved
    if (next !== '' && next < '1000') edit(next);
    else void commit(next);
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
  const cityField = useQuickField(personId, 'city', city ?? '');
  const countryField = useQuickField(personId, 'country', country ?? '');
  const cityValue = cityField.value;
  const countryValue = countryField.value;

  // Imported contacts may carry a country name or free text instead of a code. Show those as they are
  // (a known name selects its code) so nothing is lost until the user picks another country.
  const countryByName = countries.find((option) => option.name === countryValue);
  const countryIsKnown = countries.some((option) => option.code === countryValue);
  const selectedCountry = countryIsKnown ? countryValue : countryByName?.code ?? countryValue;
  const countryIsUnknown = countryValue !== '' && !countryIsKnown && !countryByName;

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
        onChange={(event) => cityField.edit(event.target.value)}
        onBlur={(event) => void cityField.commit(event.target.value.trim())}
        onKeyDown={commitOnEnter}
        className={`${inputClass} w-32`}
      />
      <select
        value={selectedCountry}
        aria-label={t('countryPlaceholder')}
        onChange={(event) => void countryField.commit(event.target.value)}
        className={`${inputClass} w-36 ${selectedCountry === '' ? 'text-muted' : ''}`}
      >
        <option value="">{t('countryPlaceholder')}</option>
        {countryIsUnknown && <option value={countryValue}>{countryValue}</option>}
        {countries.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
