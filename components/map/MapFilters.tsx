'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MapGroup, MapMarker, MapRelationshipType } from '@/lib/map/types';
import {
  distinctCities,
  distinctCountries,
  distinctRegions,
  NO_RELATIONSHIP_FILTER,
  type MapFilterState,
} from '@/lib/map/filter-markers';
import { LAST_CONTACT_FILTERS } from '@/lib/map/last-contact';
import { getCountryName } from '@/lib/countries';

interface MapFiltersProps {
  filters: MapFilterState;
  markers: MapMarker[];
  groups: MapGroup[];
  relationshipTypes: MapRelationshipType[];
  onChange: (next: MapFilterState) => void;
}

export default function MapFilters({ filters, markers, groups, relationshipTypes, onChange }: MapFiltersProps) {
  const t = useTranslations('map');
  const [moreOpen, setMoreOpen] = useState(false);
  const cities = distinctCities(markers);
  const regions = distinctRegions(markers);
  const countries = distinctCountries(markers);
  const hasLocationFilter = Boolean(filters.city || filters.region || filters.country);
  // A location filter that is active must never hide behind the collapsed
  // "more filters" section on a phone.
  const showLocation = moreOpen || hasLocationFilter;

  // Mobile: search on its own row, group and relationship side by side, then
  // last contact next to the "more filters" button; the three location
  // selects only show once expanded. Desktop (sm+): a single wrapping flex
  // row with everything visible.
  const selectClasses =
    'w-full sm:w-auto min-h-11 sm:min-h-0 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
  const locationClasses = `${selectClasses} ${showLocation ? '' : 'hidden sm:block'}`;

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center px-4 py-3 bg-surface border-b border-border">
      <input
        type="search"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder={t('searchPlaceholder')}
        className={`${selectClasses} col-span-2 sm:flex-1 sm:min-w-[10rem]`}
        aria-label={t('searchPlaceholder')}
      />

      <select
        value={filters.groupId}
        onChange={(e) => onChange({ ...filters, groupId: e.target.value })}
        className={selectClasses}
        aria-label={t('allGroups')}
      >
        <option value="">{t('allGroups')}</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>

      <select
        value={filters.relationshipId}
        onChange={(e) => onChange({ ...filters, relationshipId: e.target.value })}
        className={selectClasses}
        aria-label={t('allRelationships')}
      >
        <option value="">{t('allRelationships')}</option>
        <option value={NO_RELATIONSHIP_FILTER}>{t('noRelationship')}</option>
        {relationshipTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>

      <select
        value={filters.lastContact}
        onChange={(e) => onChange({ ...filters, lastContact: e.target.value })}
        className={selectClasses}
        aria-label={t('lastContactAny')}
      >
        <option value="">{t('lastContactAny')}</option>
        {LAST_CONTACT_FILTERS.map((value) => (
          <option key={value} value={value}>
            {t(`lastContactFilter.${value}`)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setMoreOpen((open) => !open)}
        aria-expanded={showLocation}
        className="sm:hidden min-h-11 px-3 py-2 text-sm text-primary border border-border rounded-lg bg-surface hover:bg-surface-elevated transition-colors"
      >
        {showLocation ? t('fewerFilters') : t('moreFilters')}
      </button>

      {/* City, state/province and country are mutually exclusive: picking
          one clears the others, since combining them mostly produces
          impossible matches. */}
      <select
        value={filters.city}
        onChange={(e) => onChange({ ...filters, city: e.target.value, region: '', country: '' })}
        className={locationClasses}
        aria-label={t('allCities')}
      >
        <option value="">{t('allCities')}</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>

      <select
        value={filters.region}
        onChange={(e) => onChange({ ...filters, region: e.target.value, city: '', country: '' })}
        className={locationClasses}
        aria-label={t('allRegions')}
      >
        <option value="">{t('allRegions')}</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>

      <select
        value={filters.country}
        onChange={(e) => onChange({ ...filters, country: e.target.value, city: '', region: '' })}
        className={`${locationClasses} col-span-2 sm:col-span-1`}
        aria-label={t('allCountries')}
      >
        <option value="">{t('allCountries')}</option>
        {countries.map((country) => (
          <option key={country} value={country}>
            {getCountryName(country) || country}
          </option>
        ))}
      </select>
    </div>
  );
}
