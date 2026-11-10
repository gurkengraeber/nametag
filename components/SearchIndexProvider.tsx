'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type MiniSearch from 'minisearch';
import {
  createSearchIndex,
  getIndexedPerson,
  searchIndex as performSearch,
} from '@/lib/search-index';
import type { SearchDocument, PersonSearchResult } from '@/lib/search-index';

export interface SearchGroupOption {
  id: string;
  name: string;
}

export interface SearchRelationshipTypeOption {
  id: string;
  label: string;
}

interface SearchIndexContextType {
  search: (query: string) => PersonSearchResult[];
  /** Looks one person up by id, for example to resolve recently opened people. */
  getPerson: (id: string) => PersonSearchResult | null;
  isReady: boolean;
  /** Grows with every successful load, so callers can re-run a search on fresh data. */
  version: number;
  /** True when the last attempt to load the index failed. */
  hasError: boolean;
  /** Groups and relationship types the quick actions can offer. */
  groups: SearchGroupOption[];
  relationshipTypes: SearchRelationshipTypeOption[];
  /** True once the index has loaded and holds no people at all. */
  isEmpty: boolean;
  refreshIndex: () => void;
  /** The signed-in account, used to keep per-account browser data apart. */
  userId?: string;
}

const NO_GROUPS: SearchGroupOption[] = [];
const NO_TYPES: SearchRelationshipTypeOption[] = [];

const SearchIndexContext = createContext<SearchIndexContextType | undefined>(undefined);

interface IndexPayload {
  people: SearchDocument[];
  groups?: SearchGroupOption[];
  relationshipTypes?: SearchRelationshipTypeOption[];
}

async function fetchIndexPayload(): Promise<IndexPayload | null> {
  try {
    const response = await fetch('/api/people/search-index');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

interface LoadedIndex {
  userId: string;
  index: MiniSearch<SearchDocument>;
  groups: SearchGroupOption[];
  relationshipTypes: SearchRelationshipTypeOption[];
  isEmpty: boolean;
}

export function SearchIndexProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [loaded, setLoaded] = useState<LoadedIndex | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // Only the newest load may apply its answer; older ones are stale.
  const loadCounterRef = useRef(0);

  const loadIndex = useCallback((forUser: string) => {
    const loadId = ++loadCounterRef.current;
    fetchIndexPayload().then((data) => {
      if (loadId !== loadCounterRef.current) return;
      if (!data || !Array.isArray(data.people)) {
        // Search falls back to the server; the error flag lets the UI say so.
        setFailedFor(forUser);
        return;
      }
      setLoaded({
        userId: forUser,
        index: createSearchIndex(data.people),
        groups: data.groups ?? [],
        relationshipTypes: data.relationshipTypes ?? [],
        isEmpty: data.people.length === 0,
      });
      setFailedFor(null);
      setVersion((current) => current + 1);
    });
  }, []);

  // Keyed on the account, not the session object: the session object is
  // replaced on every refetch, which would reload every person each time.
  useEffect(() => {
    if (userId) loadIndex(userId);
    else loadCounterRef.current++;
  }, [userId, loadIndex]);

  // People loaded for another account, or after signing out, are never served.
  const active = loaded && loaded.userId === userId ? loaded : null;

  const search = useCallback(
    (query: string): PersonSearchResult[] => (active ? performSearch(active.index, query) : []),
    [active]
  );

  const getPerson = useCallback(
    (id: string): PersonSearchResult | null => (active ? getIndexedPerson(active.index, id) : null),
    [active]
  );

  const refreshIndex = useCallback(() => {
    if (userId) loadIndex(userId);
  }, [userId, loadIndex]);

  return (
    <SearchIndexContext.Provider
      value={{
        search,
        getPerson,
        isReady: active !== null,
        version,
        hasError: failedFor === userId,
        groups: active?.groups ?? NO_GROUPS,
        relationshipTypes: active?.relationshipTypes ?? NO_TYPES,
        isEmpty: active?.isEmpty ?? false,
        refreshIndex,
        userId,
      }}
    >
      {children}
    </SearchIndexContext.Provider>
  );
}

export function useSearchIndex() {
  const context = useContext(SearchIndexContext);
  if (!context) {
    throw new Error('useSearchIndex must be used within a SearchIndexProvider');
  }
  return context;
}
