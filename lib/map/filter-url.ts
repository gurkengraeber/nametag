import { EMPTY_MAP_FILTERS, type MapFilterState } from './filter-markers';
import { isLastContactFilter } from './last-contact';

/** URL parameter name for each filter, in a stable order. */
const PARAM_BY_FILTER: ReadonlyArray<readonly [keyof MapFilterState, string]> = [
  ['query', 'q'],
  ['groupId', 'group'],
  ['relationshipId', 'rel'],
  ['lastContact', 'contact'],
  ['city', 'city'],
  ['region', 'region'],
  ['country', 'country'],
];

/** Every query parameter that belongs to the map (filters plus the focus deep link). */
export const MAP_PARAM_NAMES: readonly string[] = [...PARAM_BY_FILTER.map(([, param]) => param), 'focus'];

export function filtersFromParams(params: URLSearchParams): MapFilterState {
  const filters: MapFilterState = { ...EMPTY_MAP_FILTERS };
  for (const [key, param] of PARAM_BY_FILTER) {
    filters[key] = params.get(param) ?? '';
  }
  // An unknown value would silently match everyone while showing an empty select.
  if (!isLastContactFilter(filters.lastContact)) filters.lastContact = '';
  return filters;
}

export function filtersToParams(filters: MapFilterState): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, param] of PARAM_BY_FILTER) {
    if (filters[key]) params.set(param, filters[key]);
  }
  return params;
}

/** True when the URL already carries any map parameter (filters or focus). */
export function hasMapParams(params: URLSearchParams): boolean {
  return MAP_PARAM_NAMES.some((name) => params.has(name));
}

/** Stable string form of a filter state, used to compare filter states and to key camera fitting. */
export function serializeFilters(filters: MapFilterState): string {
  return PARAM_BY_FILTER.map(([key]) => filters[key]).join('|');
}
