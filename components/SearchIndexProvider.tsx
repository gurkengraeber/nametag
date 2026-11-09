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

const SearchIndexContext = createContext<SearchIndexContextType | undefined>(undefined);

interface IndexPayload {
  people: SearchDocument[];
  groups?: SearchGroupOption[];
  relationshipTypes?: SearchRelationshipTypeOption[];
}

export function SearchIndexProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [version, setVersion] = useState(0);
  const [groups, setGroups] = useState<SearchGroupOption[]>([]);
  const [relationshipTypes, setRelationshipTypes] = useState<SearchRelationshipTypeOption[]>([]);
  const indexRef = useRef<MiniSearch<SearchDocument> | null>(null);

  const loadIndex = useCallback(async () => {
    try {
      const response = await fetch('/api/people/search-index');
      if (!response.ok) {
        setHasError(true);
        return;
      }
      const data: IndexPayload = await response.json();

      indexRef.current = createSearchIndex(data.people);
      setGroups(data.groups ?? []);
      setRelationshipTypes(data.relationshipTypes ?? []);
      setIsEmpty(data.people.length === 0);
      setHasError(false);
      setIsReady(true);
      setVersion((current) => current + 1);
    } catch {
      // Search falls back to the server; the error flag lets the UI say so.
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadIndex();
    }
  }, [session, loadIndex]);

  const search = useCallback((query: string): PersonSearchResult[] => {
    if (!indexRef.current) return [];
    return performSearch(indexRef.current, query);
  }, []);

  const getPerson = useCallback((id: string): PersonSearchResult | null => {
    if (!indexRef.current) return null;
    return getIndexedPerson(indexRef.current, id);
  }, []);

  const refreshIndex = useCallback(() => {
    loadIndex();
  }, [loadIndex]);

  return (
    <SearchIndexContext.Provider
      value={{
        search,
        getPerson,
        isReady,
        version,
        hasError,
        groups,
        relationshipTypes,
        isEmpty,
        refreshIndex,
        userId: session?.user?.id,
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
