'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { formatFullName } from '@/lib/nameUtils';
import { getLocalDateString } from '@/lib/date-format';
import { navigateTo } from '@/lib/client-navigation';
import { isSearchShortcut } from '@/lib/keyboard-shortcuts';
import { forgetRecentPeople, readRecentPeople, rememberRecentPerson } from '@/lib/recent-people';
import type { PersonSearchResult } from '@/lib/search-index';
import PersonAvatar from './PersonPhoto';
import EmptyState from './EmptyState';
import { useSearchIndex } from './SearchIndexProvider';
import { fetchNameOrder, type NameOrder } from '@/lib/user-name-order';

/** A search hit. Hits from the server fallback carry no context fields. */
type Hit = Omit<PersonSearchResult, 'score'> & { score?: number };

type ActionView = 'menu' | 'groups' | 'relationships';

interface ActionsState {
  personId: string;
  view: ActionView;
}

interface NavigationSearchProps {
  /** Focus the field as soon as it mounts, for surfaces opened on demand. */
  autoFocus?: boolean;
  /**
   * Called when the search surface should collapse. `navigate` means a result
   * was picked and the page is about to change, so the caller should leave focus
   * alone; `dismiss` means the user backed out and focus should come back.
   */
  onClose?: (reason: 'dismiss' | 'navigate') => void;
}

/** Past this many options a sub-list gets its own filter field. */
const FILTER_THRESHOLD = 6;
const MAX_LISTED_GROUPS = 2;

const pillClasses =
  'inline-flex items-center gap-1.5 px-3 py-2 min-h-11 sm:min-h-0 sm:py-1 text-xs font-medium rounded-full border border-border text-muted hover:text-primary hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:border-border focus:outline-none focus:ring-2 focus:ring-primary';

const optionClasses =
  'w-full flex items-center justify-between gap-2 text-left px-3 py-2 min-h-11 sm:min-h-0 text-sm rounded-lg text-foreground hover:bg-surface-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary';

function CheckIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function NavigationSearch({ autoFocus, onClose }: NavigationSearchProps) {
  const router = useRouter();
  const t = useTranslations('nav.search');
  const [results, setResults] = useState<Hit[]>([]);
  const [recents, setRecents] = useState<Hit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [nameOrder, setNameOrder] = useState<NameOrder>('WESTERN');
  const [actions, setActions] = useState<ActionsState | null>(null);
  const [subFilter, setSubFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const {
    search: clientSearch,
    getPerson,
    isReady: searchIndexReady,
    version: indexVersion,
    isEmpty: indexIsEmpty = false,
    groups = [],
    relationshipTypes = [],
    refreshIndex,
    userId,
  } = useSearchIndex();

  // Fetch user's name order preference
  useEffect(() => {
    let active = true;
    fetchNameOrder().then((order) => {
      if (active) {
        setNameOrder(order);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cmd+K / Ctrl+K global shortcut to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isSearchShortcut(e)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const hasTerm = searchTerm.trim().length > 0;
  const items: Hit[] = hasTerm ? results : recents;
  // Groups, relationship types and last contact only exist for hits from the index.
  const canQuickAct = searchIndexReady;

  // Search: instant client-side when index is ready, server fallback otherwise
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setIsLoading(false);
      setSearchFailed(false);
      return;
    }

    if (searchIndexReady) {
      setResults(clientSearch(searchTerm));
      setIsLoading(false);
      setSearchFailed(false);
      return;
    }

    // Fallback: server-side search with debounce. A slow answer for an earlier
    // term must never replace the results of the current one, so every run owns
    // an AbortController and ignores what comes back once it was cancelled.
    setIsLoading(true);
    setSearchFailed(false);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/people/search?q=${encodeURIComponent(searchTerm)}`, {
          signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        if (controller.signal.aborted) return;
        setResults(data?.people || []);
        setSearchFailed(!response.ok);
      } catch {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearchFailed(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // indexVersion re-runs the search after a quick action changed the data.
  }, [searchTerm, searchIndexReady, clientSearch, indexVersion, retryCount]);

  // Recently opened people, resolved against the index so they are never stale.
  const refreshRecents = useCallback((): Hit[] => {
    if (!searchIndexReady) return [];
    const ids = readRecentPeople(userId);
    const found: Hit[] = [];
    const missing: string[] = [];
    for (const id of ids) {
      const person = getPerson(id);
      if (person) found.push(person);
      else missing.push(id);
    }
    forgetRecentPeople(userId, missing);
    return found;
  }, [searchIndexReady, getPerson, userId]);

  useEffect(() => {
    const list = refreshRecents();
    setRecents(list);
    // A field focused before the index arrived can now show its suggestions.
    if (document.activeElement === inputRef.current && !searchTerm && (list.length > 0 || indexIsEmpty)) {
      setIsOpen(true);
    }
    // searchTerm is read for the focus check only and must not refetch recents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshRecents, indexVersion, indexIsEmpty]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActions(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
    setActions(null);
  }, [searchTerm]);

  // Move focus into the quick action panel when it opens.
  const actionsPersonId = actions?.personId ?? null;
  const actionsView = actions?.view ?? null;
  useEffect(() => {
    if (!actionsPersonId) return;
    const first = panelRef.current?.querySelector<HTMLElement>('input, button:not([disabled])');
    first?.focus();
  }, [actionsPersonId, actionsView]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
  };

  const closeActions = (restoreFocus = true) => {
    setActions(null);
    setSubFilter('');
    // On a touch screen, handing focus back would raise the keyboard again.
    const touchFirst = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    if (restoreFocus && !touchFirst) inputRef.current?.focus();
  };

  const openActions = (hit: Hit, view: ActionView = 'menu') => {
    setSubFilter('');
    setActions({ personId: hit.id, view });
  };

  const handleSelect = (person: Hit) => {
    rememberRecentPerson(userId, person.id);
    setSearchTerm('');
    setIsOpen(false);
    setActions(null);
    inputRef.current?.blur();
    onClose?.('navigate');
    navigateTo(router, `/people/${person.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter and Escape belong to the input method while a Japanese or Chinese
    // word is being composed; they must not pick a result.
    if (e.nativeEvent.isComposing) return;

    // Escape dismisses the whole search surface, even with the results list closed,
    // so an empty on-demand field can still be backed out of with one key.
    if (e.key === 'Escape') {
      e.preventDefault();
      if (actions) {
        closeActions();
        return;
      }
      setIsOpen(false);
      setSearchTerm('');
      inputRef.current?.blur();
      onClose?.('dismiss');
      return;
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    const highlighted = items[highlightedIndex];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev < items.length - 1 ? prev + 1 : prev;
          itemRefs.current.get(next)?.scrollIntoView({ block: 'nearest' });
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          itemRefs.current.get(next)?.scrollIntoView({ block: 'nearest' });
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (!highlighted) break;
        // Shift+Enter works on the person without leaving the page.
        if (e.shiftKey && canQuickAct) {
          openActions(highlighted);
        } else if (!e.shiftKey) {
          handleSelect(highlighted);
        }
        break;
      case 'Tab':
        // Tab steps from the field into the highlighted person's quick actions.
        if (!e.shiftKey && highlighted && canQuickAct && !isLoading) {
          e.preventDefault();
          if (actions?.personId === highlighted.id) {
            panelRef.current?.querySelector<HTMLElement>('input, button:not([disabled])')?.focus();
          } else {
            openActions(highlighted);
          }
        }
        break;
    }
  };

  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (actions && actions.view !== 'menu') {
        setSubFilter('');
        setActions({ personId: actions.personId, view: 'menu' });
      } else {
        closeActions();
      }
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled])') ?? []
      );
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      if (current === -1) return;
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? current + 1 : current - 1;
      if (next < 0) {
        inputRef.current?.focus();
      } else {
        focusable[Math.min(next, focusable.length - 1)]?.focus();
      }
    }
  };

  const handleFocus = () => {
    const list = refreshRecents();
    setRecents(list);
    if (searchTerm || list.length > 0 || (searchIndexReady && indexIsEmpty)) {
      setIsOpen(true);
    }
  };

  // Quick actions: change a person without opening the profile.
  const runAction = async (
    hit: Hit,
    request: { url: string; method: 'PUT' | 'POST'; body: Record<string, unknown> },
    successMessage: string
  ) => {
    const name = formatFullName(hit, nameOrder);
    setBusy(true);
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      toast.success(successMessage);
      refreshIndex();
      closeActions();
    } catch {
      toast.error(t('actions.failed', { name }));
    } finally {
      setBusy(false);
    }
  };

  const markContactedToday = (hit: Hit) =>
    runAction(
      hit,
      { url: `/api/people/${hit.id}`, method: 'PUT', body: { lastContact: getLocalDateString() } },
      t('actions.contactedDone', { name: formatFullName(hit, nameOrder) })
    );

  const addToGroup = (hit: Hit, groupId: string, groupName: string) =>
    runAction(
      hit,
      { url: '/api/people/bulk', method: 'POST', body: { action: 'addToGroups', personIds: [hit.id], groupIds: [groupId] } },
      t('actions.addedToGroup', { name: formatFullName(hit, nameOrder), group: groupName })
    );

  const setRelationship = (hit: Hit, typeId: string, label: string) =>
    runAction(
      hit,
      { url: '/api/people/bulk', method: 'POST', body: { action: 'setRelationship', personIds: [hit.id], relationshipTypeId: typeId } },
      t('actions.relationshipSet', { name: formatFullName(hit, nameOrder), relationship: label })
    );

  const contextLine = (hit: Hit): string => {
    const names = hit.groupNames ?? [];
    const shownGroups = names.slice(0, MAX_LISTED_GROUPS).join(', ');
    const extra = names.length > MAX_LISTED_GROUPS ? ` +${names.length - MAX_LISTED_GROUPS}` : '';
    return [hit.relationship, shownGroups ? `${shownGroups}${extra}` : null, hit.locality ?? hit.organization]
      .filter(Boolean)
      .join(' · ');
  };

  const renderOptionList = (
    options: Array<{ id: string; label: string; selected: boolean }>,
    emptyText: string,
    emptyHref: string,
    emptyLinkText: string,
    onPick: (id: string, label: string) => void
  ) => {
    const needle = subFilter.trim().toLowerCase();
    const shown = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;

    return (
      <div className="space-y-2">
        {options.length > FILTER_THRESHOLD && (
          <input
            type="text"
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            placeholder={t('actions.filter')}
            aria-label={t('actions.filter')}
            autoComplete="off"
            className="w-full px-3 py-1.5 text-base sm:text-sm border border-border rounded-lg bg-surface-elevated text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          />
        )}
        {options.length === 0 ? (
          <p className="text-sm text-muted px-1">
            {emptyText}{' '}
            <Link href={emptyHref} className="text-primary hover:underline">{emptyLinkText}</Link>
          </p>
        ) : (
          <div className="max-h-48 overflow-auto space-y-0.5">
            {shown.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={busy || option.selected}
                aria-pressed={option.selected}
                onClick={() => onPick(option.id, option.label)}
                className={optionClasses}
              >
                <span className="truncate">{option.label}</span>
                {option.selected && <CheckIcon />}
              </button>
            ))}
            {shown.length === 0 && (
              <p className="text-sm text-muted px-3 py-2">{t('actions.noMatches')}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderActionsPanel = (hit: Hit) => {
    if (!actions || actions.personId !== hit.id) return null;
    const today = getLocalDateString();
    const contactedToday = hit.lastContact === today;
    const hitGroupIds = hit.groupIds ?? [];

    return (
      <div
        ref={panelRef}
        role="group"
        aria-label={t('actions.title')}
        aria-busy={busy}
        onKeyDown={handlePanelKeyDown}
        className="px-4 pb-3 pt-1 bg-surface-elevated/50 border-l-2 border-l-primary/40"
      >
        {actions.view === 'menu' && (
          <div className="flex flex-wrap gap-2 pl-8">
            <button
              type="button"
              disabled={busy || contactedToday}
              onClick={() => markContactedToday(hit)}
              className={pillClasses}
            >
              {contactedToday ? <CheckIcon /> : null}
              {contactedToday ? t('actions.alreadyContactedToday') : t('actions.contactedToday')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openActions(hit, 'groups')}
              className={pillClasses}
            >
              {t('actions.addToGroup')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openActions(hit, 'relationships')}
              className={pillClasses}
            >
              {t('actions.setRelationship')}
            </button>
          </div>
        )}

        {actions.view !== 'menu' && (
          <div className="pl-8 space-y-2">
            <button
              type="button"
              onClick={() => openActions(hit, 'menu')}
              className="inline-flex items-center gap-1 min-h-11 sm:min-h-0 text-xs font-medium text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('actions.back')}
            </button>
            {actions.view === 'groups' &&
              renderOptionList(
                groups.map((group) => ({
                  id: group.id,
                  label: group.name,
                  selected: hitGroupIds.includes(group.id),
                })),
                t('actions.noGroups'),
                '/groups/new',
                t('actions.createGroup'),
                (id, label) => addToGroup(hit, id, label)
              )}
            {actions.view === 'relationships' &&
              renderOptionList(
                relationshipTypes.map((type) => ({
                  id: type.id,
                  label: type.label,
                  selected: hit.relationshipTypeId === type.id,
                })),
                t('actions.noRelationshipTypes'),
                '/relationship-types/new',
                t('actions.createRelationshipType'),
                (id, label) => setRelationship(hit, id, label)
              )}
          </div>
        )}
      </div>
    );
  };

  const matchedInLabel = (hit: Hit): string | null => {
    if (!hit.matchedIn) return null;
    return t(`matchedIn.${hit.matchedIn}`);
  };

  const renderHits = (hits: Hit[]) =>
    hits.map((person, index) => {
      const displayName = formatFullName(person, nameOrder);
      const context = contextLine(person);
      const matched = matchedInLabel(person);
      const highlighted = index === highlightedIndex;
      const expanded = actions?.personId === person.id;

      return (
        <div key={person.id}>
          <div
            ref={(el) => {
              if (el) itemRefs.current.set(index, el);
              else itemRefs.current.delete(index);
            }}
            className={`flex items-stretch border-l-2 transition-colors hover:bg-surface-elevated ${
              highlighted ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
            }`}
            onMouseEnter={() => setHighlightedIndex(index)}
          >
            <button
              type="button"
              onClick={() => handleSelect(person)}
              className="flex-1 min-w-0 text-left px-4 py-2.5 min-h-11 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <div className="flex items-center gap-2 text-foreground font-medium">
                <PersonAvatar personId={person.id} name={displayName} photo={person.photo} size={24} />
                <span className="truncate">{displayName}</span>
              </div>
              {(context || matched) && (
                <div className="mt-0.5 pl-8 text-xs text-muted truncate">
                  {context}
                  {context && matched ? ' · ' : ''}
                  {matched && <span className="text-primary">{matched}</span>}
                </div>
              )}
            </button>
            {canQuickAct && (
              <button
                type="button"
                onClick={() => (expanded ? closeActions(false) : openActions(person))}
                aria-expanded={expanded}
                aria-label={t('actions.title')}
                title={t('actions.title')}
                className="shrink-0 w-11 flex items-center justify-center text-muted hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
          </div>
          {renderActionsPanel(person)}
        </div>
      );
    });

  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const showRecents = isOpen && !hasTerm && recents.length > 0;
  const showEmptyLibrary = isOpen && !hasTerm && recents.length === 0 && searchIndexReady && indexIsEmpty;
  const showResults = isOpen && hasTerm && !isLoading && !searchFailed && results.length > 0;
  const showNoResults = isOpen && hasTerm && !isLoading && !searchFailed && results.length === 0;
  const dropdownBase = 'absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg';
  const listMaxHeight = 'max-h-[min(24rem,60vh)] overflow-auto';

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          /* Handled by React during commit, so the focus lands in the same task
             as the tap that opened the field. iOS Safari only raises the software
             keyboard for a focus tied to the gesture, which a passive effect misses. */
          autoFocus={autoFocus}
          className="w-full pl-9 pr-12 py-1.5 text-base sm:text-sm border border-border rounded-lg bg-surface-elevated text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          autoComplete="off"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-muted bg-background border border-border rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Screen readers hear the outcome of each search; sighted users see the list. */}
      <p className="sr-only" role="status" aria-live="polite">
        {showResults ? t('resultCount', { count: results.length }) : ''}
      </p>

      {isOpen && hasTerm && isLoading && (
        <div className={`${dropdownBase} p-3`} role="status">
          <p className="text-sm text-muted">{t('searching')}</p>
        </div>
      )}

      {isOpen && hasTerm && !isLoading && searchFailed && (
        <div className={`${dropdownBase} p-3`} role="alert">
          <p className="text-sm text-foreground">{offline ? t('offline') : t('error')}</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-2 inline-flex items-center min-h-11 sm:min-h-0 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {showRecents && (
        <div className={`${dropdownBase} ${listMaxHeight}`}>
          <p className="px-4 pt-2.5 pb-1 text-xs font-medium text-muted">{t('recent')}</p>
          {renderHits(recents)}
        </div>
      )}

      {showEmptyLibrary && (
        <div className={dropdownBase}>
          <EmptyState
            size="compact"
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            actionLabel={t('addPerson')}
            actionHref="/people/new"
            secondaryActionLabel={t('importContacts')}
            secondaryActionHref="/settings/carddav"
          />
        </div>
      )}

      {showResults && (
        <div className={`${dropdownBase} ${listMaxHeight}`}>
          {renderHits(results)}
          {canQuickAct && (
            <p className="hidden md:block px-4 py-2 text-xs text-muted border-t border-border">
              {t('keyHint')}
            </p>
          )}
        </div>
      )}

      {showNoResults && (
        <div className={dropdownBase}>
          <EmptyState
            size="compact"
            title={t('noResults', { searchTerm })}
            description={t('noResultsHint')}
            actionLabel={t('addAsNew', { searchTerm: searchTerm.trim() })}
            actionHref={`/people/new?name=${encodeURIComponent(searchTerm.trim())}`}
          />
        </div>
      )}
    </div>
  );
}
