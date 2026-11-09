'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import BulkGroupAssignModal from '@/components/BulkGroupAssignModal';
import BulkRelationshipModal from '@/components/BulkRelationshipModal';
import { getCountryName } from '@/lib/countries';
import type { DateFormat } from '@/lib/date-format';
import type { MapGroup, MapMarker, MapMarkersResponse, MapPerson, UnplacedPerson } from '@/lib/map/types';
import {
  countDistinctPeople,
  EMPTY_MAP_FILTERS,
  filterMarkers,
  hasActiveMapFilters,
  personMatchesFilters,
  type MapFilterState,
} from '@/lib/map/filter-markers';
import { filtersFromParams, filtersToParams, hasMapParams, serializeFilters } from '@/lib/map/filter-url';
import { addIds, toggleIds } from '@/lib/map/selection';
import { buildAddressesPayload, mostCommonCountry } from '@/lib/map/unplaced';
import { savePersonAddresses } from '@/lib/map/quick-actions';
import {
  readStoredFilters,
  readStoredView,
  writeStoredFilters,
  writeStoredView,
  type StoredMapView,
} from '@/lib/map/view-storage';
import MapFilters from './MapFilters';
import MapToolbar, { type MapSelectMode } from './MapToolbar';
import MapSelectionBar from './MapSelectionBar';
import MapPersonCard from './MapPersonCard';
import MapPeoplePanel, { type MapPanelTab, type PanelPerson } from './MapPeoplePanel';
import type { MapFlyToRequest } from './MapView';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

// After saving a place the geocoder works in the background; look again a
// little later so the new marker shows up without a manual reload.
const RELOAD_DELAYS_MS = [4000, 12000];

interface InitialState {
  filters: MapFilterState;
  /** Remembered camera, only used when the URL carries no map parameters */
  view: StoredMapView | null;
}

function computeInitialState(params: URLSearchParams, userId: string): InitialState {
  // A URL with filters or a focus link always wins over what was remembered.
  if (hasMapParams(params)) return { filters: filtersFromParams(params), view: null };
  if (typeof window === 'undefined') return { filters: EMPTY_MAP_FILTERS, view: null };
  return { filters: readStoredFilters(userId) ?? EMPTY_MAP_FILTERS, view: readStoredView(userId) };
}

interface MapPageClientProps {
  dateFormat: DateFormat;
  /** Account id, used to namespace what the map remembers in this browser */
  userId: string;
}

function MapPageInner({ dateFormat, userId }: MapPageClientProps) {
  const t = useTranslations('map');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<MapMarkersResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [initial] = useState(() => computeInitialState(searchParams, userId));
  const [filters, setFilters] = useState<MapFilterState>(initial.filters);
  // Filters live in React state (so typing never waits for the router) and are
  // mirrored to the URL. When the URL changes by itself (a link to /map, the
  // back button) the new URL is adopted; our own writes are recognised by key.
  const [writtenKey, setWrittenKey] = useState(() => serializeFilters(initial.filters));
  const paramsKey = searchParams.toString();
  const [seenParamsKey, setSeenParamsKey] = useState(paramsKey);
  if (paramsKey !== seenParamsKey) {
    setSeenParamsKey(paramsKey);
    const fromUrl = filtersFromParams(searchParams);
    if (serializeFilters(fromUrl) !== writtenKey) {
      setFilters(fromUrl);
      setWrittenKey(serializeFilters(fromUrl));
    }
  }
  const focusId = searchParams.get('focus');

  const [selectMode, setSelectMode] = useState<MapSelectMode>('off');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<MapPanelTab>('onMap');
  const [cardMarkerIds, setCardMarkerIds] = useState<string[] | null>(null);
  const [focusDismissed, setFocusDismissed] = useState(false);
  const [flyTo, setFlyTo] = useState<MapFlyToRequest | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  // The bulk group modal never resets its busy state after a success, so it is
  // remounted with a new key each time.
  const [groupModalKey, setGroupModalKey] = useState(0);
  const [createdGroups, setCreatedGroups] = useState<MapGroup[]>([]);

  const loadData = useCallback(async (): Promise<MapMarkersResponse | null> => {
    try {
      const response = await fetch('/api/map/markers');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as MapMarkersResponse;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadData().then((payload) => {
      if (cancelled) return;
      if (payload) setData(payload);
      else setLoadError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  // Quiet refresh after edits: keeps the camera, selection and open panels.
  const reload = useCallback(() => {
    loadData().then((payload) => {
      if (payload) setData(payload);
    });
  }, [loadData]);

  const reloadTimersRef = useRef<number[]>([]);
  useEffect(() => {
    const timers = reloadTimersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const patchPerson = useCallback((personId: string, patch: Partial<MapPerson>) => {
    setData((prev) =>
      prev
        ? { ...prev, people: prev.people.map((p) => (p.personId === personId ? { ...p, ...patch } : p)) }
        : prev
    );
  }, []);

  const handleFiltersChange = useCallback(
    (next: MapFilterState) => {
      setFilters(next);
      setWrittenKey(serializeFilters(next));
      writeStoredFilters(userId, next);
      // Changing filters drops the focus deep link on purpose
      const qs = filtersToParams(next).toString();
      router.replace(qs ? `/map?${qs}` : '/map', { scroll: false });
    },
    [router, userId]
  );

  // Arriving at a bare /map with remembered filters: put them in the URL too,
  // so the address bar is shareable like any other filtered view.
  const restoredFiltersRef = useRef(initial.filters);
  useEffect(() => {
    if (hasMapParams(new URLSearchParams(window.location.search))) return;
    const qs = filtersToParams(restoredFiltersRef.current).toString();
    if (qs) router.replace(`/map?${qs}`, { scroll: false });
  }, [router]);

  const handleViewChange = useCallback((view: StoredMapView) => writeStoredView(userId, view), [userId]);

  const peopleById = useMemo(
    () => new Map((data?.people ?? []).map((person) => [person.personId, person])),
    [data]
  );

  const visibleMarkers = useMemo(
    () => (data ? filterMarkers(data.markers, filters, peopleById) : []),
    [data, filters, peopleById]
  );
  const visiblePeopleCount = countDistinctPeople(visibleMarkers);

  const visiblePanelPeople = useMemo<PanelPerson[]>(() => {
    const seen = new Set<string>();
    const result: PanelPerson[] = [];
    for (const marker of visibleMarkers) {
      if (seen.has(marker.personId)) continue;
      seen.add(marker.personId);
      const placeText = [marker.city, marker.country ? getCountryName(marker.country) || marker.country : null]
        .filter(Boolean)
        .join(', ');
      result.push({ personId: marker.personId, personName: marker.personName, placeText });
    }
    return result.sort((a, b) => a.personName.localeCompare(b.personName));
  }, [visibleMarkers]);

  // People without a place cannot be filtered by city, state or country, so
  // only the person-level filters apply to them.
  const visibleUnplaced = useMemo<UnplacedPerson[]>(() => {
    if (!data) return [];
    return data.unplacedPeople.filter((unplaced) => {
      const person = peopleById.get(unplaced.personId);
      return personMatchesFilters(
        {
          personName: unplaced.personName,
          groupIds: person?.groupIds ?? [],
          relationshipTypeId: person?.relationshipTypeId ?? null,
          lastContact: person?.lastContact ?? null,
        },
        filters
      );
    });
  }, [data, filters, peopleById]);

  const defaultCountry = useMemo(
    () => mostCommonCountry((data?.markers ?? []).map((marker) => marker.country)),
    [data]
  );

  const allGroups = useMemo(() => {
    const base = data?.allGroups ?? [];
    return [...base, ...createdGroups.filter((created) => !base.some((group) => group.id === created.id))];
  }, [data, createdGroups]);

  // Card: the clicked markers, or the ?focus= deep link until it is closed.
  const cardMarkers = useMemo<MapMarker[]>(() => {
    if (!data) return [];
    if (cardMarkerIds) {
      return cardMarkerIds
        .map((id) => data.markers.find((marker) => marker.id === id))
        .filter((marker): marker is MapMarker => marker !== undefined);
    }
    if (focusId && !focusDismissed) {
      const target = data.markers.find((marker) => marker.id === focusId);
      return target ? [target] : [];
    }
    return [];
  }, [data, cardMarkerIds, focusId, focusDismissed]);

  const closeCard = useCallback(() => {
    setCardMarkerIds(null);
    setFocusDismissed(true);
  }, []);

  const handleSelectModeChange = useCallback(
    (mode: MapSelectMode) => {
      setSelectMode(mode);
      if (mode !== 'off') closeCard();
    },
    [closeCard]
  );

  const handleTogglePersons = useCallback((personIds: string[]) => {
    setSelectedIds((prev) => toggleIds(prev, personIds));
  }, []);

  const handleFrameSelect = useCallback((personIds: string[]) => {
    setSelectedIds((prev) => addIds(prev, personIds));
  }, []);

  const handleSelectAllShown = useCallback(() => {
    setSelectedIds((prev) => addIds(prev, visibleMarkers.map((marker) => marker.personId)));
  }, [visibleMarkers]);

  const handleStartSelection = useCallback(
    (personIds: string[]) => {
      setSelectMode('tap');
      setSelectedIds((prev) => addIds(prev, personIds));
      closeCard();
    },
    [closeCard]
  );

  const handleActivate = useCallback((markerIds: string[]) => {
    setFocusDismissed(true);
    setCardMarkerIds(markerIds);
  }, []);

  const handleShowOnMap = useCallback(
    (personId: string) => {
      const marker = visibleMarkers.find((m) => m.personId === personId);
      if (!marker) return;
      setFlyTo({ markerId: marker.id });
      handleActivate([marker.id]);
    },
    [visibleMarkers, handleActivate]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkSuccess = useCallback(() => {
    setSelectedIds(new Set());
    setShowGroupModal(false);
    setShowRelationshipModal(false);
    setGroupModalKey((key) => key + 1);
    reload();
  }, [reload]);

  const handleSavePlace = useCallback(
    async (person: UnplacedPerson, city: string, country: string): Promise<boolean> => {
      const addresses = buildAddressesPayload(person.addresses, city, country);
      if (!addresses) return false;
      const ok = await savePersonAddresses(person.personId, addresses);
      if (!ok) return false;
      setData((prev) =>
        prev
          ? {
              ...prev,
              unplacedPeople: prev.unplacedPeople.map((p) =>
                p.personId === person.personId ? { ...p, reason: 'pending', addresses } : p
              ),
            }
          : prev
      );
      toast.success(t('placeSaved'));
      for (const delay of RELOAD_DELAYS_MS) {
        reloadTimersRef.current.push(window.setTimeout(reload, delay));
      }
      return true;
    },
    [reload, t]
  );

  const togglePanel = useCallback(() => setPanelOpen((open) => !open), []);

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted">{t('loadError')}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted">{t('loading')}</p>
      </div>
    );
  }

  const showBanner = !bannerDismissed && (data.pendingCount > 0 || data.failedCount > 0);
  const hasMarkers = data.markers.length > 0;

  return (
    <div className="flex-1 flex flex-col">
      <MapFilters
        filters={filters}
        markers={data.markers}
        groups={data.groups}
        relationshipTypes={data.relationshipTypes}
        onChange={handleFiltersChange}
      />

      <MapToolbar
        peopleCount={visiblePeopleCount}
        hasActiveFilters={hasActiveMapFilters(filters)}
        onClearFilters={() => handleFiltersChange(EMPTY_MAP_FILTERS)}
        selectMode={selectMode}
        onSelectModeChange={handleSelectModeChange}
        onSelectAllShown={handleSelectAllShown}
        listOpen={panelOpen}
        onToggleList={togglePanel}
        unplacedCount={data.unplacedPeople.length}
        mapAvailable={hasMarkers}
      />

      {showBanner && (
        <div className="flex items-center justify-between gap-4 px-4 py-2 bg-surface-elevated border-b border-border text-sm text-muted">
          <span>
            {data.pendingCount > 0 && t('pendingBanner', { count: data.pendingCount })}
            {data.pendingCount > 0 && data.failedCount > 0 && ' '}
            {data.failedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPanelTab('noPlace');
                  setPanelOpen(true);
                }}
                className="min-h-11 sm:min-h-0 underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {t('failedBanner', { count: data.failedCount })}
              </button>
            )}
          </span>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="min-h-11 sm:min-h-0 text-primary hover:text-primary-dark transition-colors"
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      <div className="flex-1 relative min-h-[60vh]">
        {!hasMarkers ? (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <h2 className="text-lg font-semibold text-foreground mb-2">{t('emptyTitle')}</h2>
              <p className="text-muted">
                {data.geocodingEnabled ? t('emptyDescription') : t('emptyGeocodingDisabled')}
              </p>
            </div>
          </div>
        ) : (
          <>
            <MapView
              markers={visibleMarkers}
              focusId={focusId}
              filtersKey={serializeFilters(filters)}
              initialView={initial.view}
              onViewChange={handleViewChange}
              selectMode={selectMode}
              selectedPersonIds={selectedIds}
              flyTo={flyTo}
              onActivate={handleActivate}
              onTogglePersons={handleTogglePersons}
              onFrameSelect={handleFrameSelect}
            />
            {visibleMarkers.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-8 pointer-events-none">
                <p
                  className="px-4 py-2 rounded-lg bg-surface border border-border text-muted shadow"
                  role="status"
                >
                  {t('noResults')}
                </p>
              </div>
            )}
          </>
        )}

        {panelOpen && (
          <MapPeoplePanel
            tab={panelTab}
            onTabChange={setPanelTab}
            onClose={() => setPanelOpen(false)}
            onMap={visiblePanelPeople}
            unplaced={visibleUnplaced}
            selectedIds={selectedIds}
            onToggleSelected={(personId) => handleTogglePersons([personId])}
            onShowOnMap={handleShowOnMap}
            geocodingEnabled={data.geocodingEnabled}
            defaultCountry={defaultCountry}
            onSavePlace={handleSavePlace}
            withSelectionBar={selectedIds.size > 0}
          />
        )}

        {cardMarkers.length > 0 && selectMode === 'off' && (
          <MapPersonCard
            key={cardMarkers.map((marker) => marker.id).join(',')}
            markers={cardMarkers}
            peopleById={peopleById}
            relationshipTypes={data.relationshipTypes}
            allGroups={allGroups}
            dateFormat={dateFormat}
            onClose={closeCard}
            onStartSelection={handleStartSelection}
            onPersonChange={patchPerson}
            onSaved={reload}
          />
        )}
      </div>

      <MapSelectionBar
        count={selectedIds.size}
        onClear={clearSelection}
        onAddToGroups={() => setShowGroupModal(true)}
        onSetRelationship={() => setShowRelationshipModal(true)}
      />

      <BulkGroupAssignModal
        key={groupModalKey}
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        selectedIds={Array.from(selectedIds)}
        selectAll={false}
        totalCount={selectedIds.size}
        availableGroups={allGroups}
        onSuccess={handleBulkSuccess}
        onGroupCreated={(group) => setCreatedGroups((prev) => [...prev, group])}
      />

      <BulkRelationshipModal
        isOpen={showRelationshipModal}
        onClose={() => setShowRelationshipModal(false)}
        selectedIds={Array.from(selectedIds)}
        selectAll={false}
        totalCount={selectedIds.size}
        relationshipTypes={data.relationshipTypes}
        onSuccess={handleBulkSuccess}
      />
    </div>
  );
}

export default function MapPageClient({ dateFormat, userId }: MapPageClientProps) {
  return (
    <Suspense fallback={null}>
      <MapPageInner dateFormat={dateFormat} userId={userId} />
    </Suspense>
  );
}
