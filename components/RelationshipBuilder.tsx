'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  MAX_RECENT_LINKS,
  applyCreated,
  applyUndone,
  canUndoCleanly,
  countConnections,
  filterPeople,
  inverseTypeIdOf,
  readRecentTypeIds,
  rememberType,
  sortTypesByRecent,
  typeIdsBetween,
  writeRecentTypeIds,
  type BuilderLink,
  type BuilderPerson,
  type BuilderType,
  type Rect,
} from '@/lib/relationship-builder';
import { usePersonDrag } from '@/hooks/usePersonDrag';
import PersonCard from './relationship-builder/PersonCard';
import DragGhost from './relationship-builder/DragGhost';
import BrushBar from './relationship-builder/BrushBar';
import RecentLinks, { type RecentLink } from './relationship-builder/RecentLinks';
import TypePickerDialog from './relationship-builder/TypePickerDialog';

interface RelationshipBuilderProps {
  userId: string;
  people: BuilderPerson[];
  groups: Array<{ id: string; name: string }>;
  types: BuilderType[];
  initialLinks: BuilderLink[];
}

/** Everything needed to show and to undo one created link. */
interface CreatedLink {
  id: string;
  a: string;
  b: string;
  typeId: string;
  inverseTypeId: string;
  summary: string;
  undoable: boolean;
}

interface PendingPair {
  fromId: string;
  toId: string;
  anchor: Rect | null;
}

const UNDO_TOAST_MS = 8000;

function readRelationshipId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('relationship' in data)) return null;
  const relationship = data.relationship;
  if (typeof relationship !== 'object' || relationship === null || !('id' in relationship)) return null;
  return typeof relationship.id === 'string' ? relationship.id : null;
}

function readErrorCode(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('code' in data)) return null;
  return typeof data.code === 'string' ? data.code : null;
}

export default function RelationshipBuilder({
  userId,
  people,
  groups,
  types,
  initialLinks,
}: RelationshipBuilderProps) {
  const t = useTranslations('relationshipBuilder');
  const containerRef = useRef<HTMLDivElement>(null);

  const [links, setLinks] = useState<BuilderLink[]>(initialLinks);
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPair | null>(null);
  const [brushTypeId, setBrushTypeId] = useState<string | null>(null);
  const [recentTypeIds, setRecentTypeIds] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [undoBusyId, setUndoBusyId] = useState<string | null>(null);

  // localStorage is only readable in the browser, so the remembered order
  // arrives after the first render instead of breaking hydration.
  useEffect(() => {
    setRecentTypeIds(readRecentTypeIds(userId));
  }, [userId]);

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const typesById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);
  const sortedTypes = useMemo(() => sortTypesByRecent(types, recentTypeIds), [types, recentTypeIds]);
  const connectionCounts = useMemo(() => countConnections(links), [links]);
  const visiblePeople = useMemo(
    () => filterPeople(people, { query, groupId }),
    [people, query, groupId]
  );

  const summaryFor = useCallback(
    (from: BuilderPerson, to: BuilderPerson, type: BuilderType, preview = false): string => {
      const inverse = typesById.get(inverseTypeIdOf(type)) ?? type;
      if (inverse.id === type.id) {
        return t(preview ? 'summary.previewSymmetric' : 'summary.symmetric', { from: from.displayName, to: to.displayName, type: type.label });
      }
      return t('summary.pair', {
        from: from.displayName,
        to: to.displayName,
        type: type.label,
        inverse: inverse.label,
      });
    },
    [t, typesById]
  );

  const undoLink = useCallback(
    async (entry: CreatedLink) => {
      setUndoBusyId(entry.id);
      try {
        const response = await fetch(`/api/relationships/${entry.id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('undo failed');
        setLinks((prev) => applyUndone(prev, entry));
        setCreated((prev) => prev.filter((item) => item.id !== entry.id));
        const from = peopleById.get(entry.a);
        const to = peopleById.get(entry.b);
        const type = typesById.get(entry.typeId);
        toast.success(
          t('toast.undone', {
            from: from?.displayName ?? '',
            to: to?.displayName ?? '',
            type: type?.label ?? '',
          })
        );
      } catch {
        toast.error(t('toast.undoFailed'));
      } finally {
        setUndoBusyId(null);
      }
    },
    [peopleById, typesById, t]
  );

  const createLink = useCallback(
    async (fromId: string, toId: string, typeId: string): Promise<boolean> => {
      const from = peopleById.get(fromId);
      const to = peopleById.get(toId);
      const type = typesById.get(typeId);
      if (!from || !to || !type || fromId === toId) return false;

      if (typeIdsBetween(links, fromId, toId).includes(typeId)) {
        toast.info(t('toast.alreadyExists', { from: from.displayName, to: to.displayName, type: type.label }));
        return false;
      }

      const undoable = canUndoCleanly(links, fromId, toId);
      setBusy(true);
      try {
        const response = await fetch('/api/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId: fromId, relatedPersonId: toId, relationshipTypeId: typeId }),
        });
        const data: unknown = await response.json().catch(() => null);
        const id = response.ok ? readRelationshipId(data) : null;

        if (!id) {
          const exists = readErrorCode(data) === 'relationship_exists';
          toast.error(
            exists
              ? t('toast.alreadyExists', { from: from.displayName, to: to.displayName, type: type.label })
              : t('toast.failed')
          );
          return false;
        }

        const entry: CreatedLink = {
          id,
          a: fromId,
          b: toId,
          typeId,
          inverseTypeId: inverseTypeIdOf(type),
          summary: summaryFor(from, to, type),
          undoable,
        };
        setLinks((prev) => applyCreated(prev, entry));
        setCreated((prev) => [entry, ...prev].slice(0, MAX_RECENT_LINKS));
        setRecentTypeIds((prev) => {
          const next = rememberType(prev, typeId);
          writeRecentTypeIds(userId, next);
          return next;
        });
        toast.success(entry.summary, {
          duration: UNDO_TOAST_MS,
          ...(undoable
            ? { action: { label: t('toast.undo'), onClick: () => void undoLink(entry) } }
            : {}),
        });
        return true;
      } catch {
        toast.error(t('toast.failed'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [links, peopleById, typesById, summaryFor, undoLink, userId, t]
  );

  const rectOf = useCallback((personId: string): Rect | null => {
    const el = containerRef.current?.querySelector(`[data-person-id="${personId}"]`);
    if (!el) return null;
    const { left, top, right, bottom } = el.getBoundingClientRect();
    return { left, top, right, bottom };
  }, []);

  /** A pair was chosen, by drop or by two taps: apply the brush or ask for the type. */
  const connect = useCallback(
    (fromId: string, toId: string, anchor: Rect | null) => {
      if (fromId === toId) return;
      setSourceId(null);
      if (brushTypeId) {
        void createLink(fromId, toId, brushTypeId);
      } else {
        setPending({ fromId, toId, anchor });
      }
    },
    [brushTypeId, createLink]
  );

  const { drag, ghostRef, start, consumeClick } = usePersonDrag({
    enabled: !pending,
    onDrop: (fromId, toId, targetEl) => {
      const { left, top, right, bottom } = targetEl.getBoundingClientRect();
      connect(fromId, toId, { left, top, right, bottom });
    },
  });

  const handleActivate = useCallback(
    (personId: string) => {
      if (consumeClick()) return;
      if (!sourceId) {
        setSourceId(personId);
      } else if (sourceId === personId) {
        setSourceId(null);
      } else {
        connect(sourceId, personId, rectOf(personId));
      }
    },
    [consumeClick, sourceId, connect, rectOf]
  );

  useEffect(() => {
    if (!sourceId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSourceId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sourceId]);

  const closePicker = useCallback(() => setPending(null), []);

  const handlePick = useCallback(
    async (typeId: string) => {
      if (!pending) return;
      const ok = await createLink(pending.fromId, pending.toId, typeId);
      if (ok) setPending(null);
    },
    [pending, createLink]
  );

  const pendingFrom = pending ? peopleById.get(pending.fromId) : undefined;
  const pendingTo = pending ? peopleById.get(pending.toId) : undefined;
  const sourcePerson = sourceId ? peopleById.get(sourceId) : undefined;
  const draggedPerson = drag ? peopleById.get(drag.sourceId) : undefined;

  const existingForPending = useMemo(() => {
    if (!pending) return { ids: [] as string[], summary: null as string | null, undoable: true };
    const ids = typeIdsBetween(links, pending.fromId, pending.toId);
    const from = peopleById.get(pending.fromId);
    const to = peopleById.get(pending.toId);
    const summary =
      from && to && ids.length > 0
        ? ids
            .map((id) => typesById.get(id))
            .filter((type): type is BuilderType => Boolean(type))
            .map((type) => t('summary.preview', { from: from.displayName, to: to.displayName, type: type.label }))
            .join(', ')
        : null;
    return { ids, summary, undoable: canUndoCleanly(links, pending.fromId, pending.toId) };
  }, [pending, links, peopleById, typesById, t]);

  const previewFor = useCallback(
    (typeId: string): string => {
      const type = typesById.get(typeId);
      if (!type || !pendingFrom || !pendingTo) return '';
      return summaryFor(pendingFrom, pendingTo, type, true);
    },
    [typesById, pendingFrom, pendingTo, summaryFor]
  );

  const recentEntries: RecentLink[] = created.map((entry) => ({
    id: entry.id,
    summary: entry.summary,
    undoable: entry.undoable,
  }));

  const undoById = useCallback(
    (id: string) => {
      const entry = created.find((item) => item.id === id);
      if (entry) void undoLink(entry);
    },
    [created, undoLink]
  );

  return (
    <div ref={containerRef}>
      <p id="connect-intro" className="text-sm text-muted mb-4 max-w-2xl">
        {t('intro')}
      </p>

      <BrushBar types={sortedTypes} brushTypeId={brushTypeId} onChange={setBrushTypeId} />

      <RecentLinks entries={recentEntries} busyId={undoBusyId} onUndo={undoById} />

      <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('filters.searchPlaceholder')}
          aria-label={t('filters.searchLabel')}
          className="flex-1 min-w-0 px-3 py-2 min-h-11 text-base sm:text-sm border border-border rounded-lg bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />
        {groups.length > 0 && (
          <select
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            aria-label={t('filters.groupLabel')}
            className="w-full sm:w-56 px-3 py-2 min-h-11 text-base sm:text-sm border border-border rounded-lg bg-surface-elevated text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">{t('filters.allGroups')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {t('filters.showing', { shown: visiblePeople.length, total: people.length })}
      </p>

      {sourcePerson && (
        <div
          role="status"
          className="sticky top-2 z-30 mb-3 flex items-center gap-3 px-3 py-2 rounded-lg border border-primary bg-surface-elevated shadow-sm"
        >
          <p className="flex-1 min-w-0 text-sm text-foreground break-words">
            {t('pick.target', { name: sourcePerson.displayName })}
          </p>
          <button
            type="button"
            onClick={() => setSourceId(null)}
            className="shrink-0 px-3 py-2 min-h-11 sm:min-h-0 text-sm font-medium text-primary hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('pick.cancel')}
          </button>
        </div>
      )}

      {visiblePeople.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{t('filters.noMatches')}</p>
      ) : (
        <div
          role="group"
          aria-label={t('gridLabel')}
          aria-describedby="connect-intro"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2"
        >
          {visiblePeople.map((person) => {
            const count = connectionCounts.get(person.id) ?? 0;
            const connectionsLabel = t('card.connections', { count });
            return (
              <PersonCard
                key={person.id}
                person={person}
                selected={sourceId === person.id}
                dragging={drag?.sourceId === person.id}
                dropTarget={drag?.overId === person.id}
                connectionsLabel={connectionsLabel}
                ariaLabel={t('card.aria', {
                  name: person.displayName,
                  details: `${person.relationshipLabel ?? t('card.noRelationship')}, ${connectionsLabel}`,
                })}
                onPointerDown={start}
                onActivate={handleActivate}
              />
            );
          })}
        </div>
      )}

      {drag && draggedPerson && <DragGhost person={draggedPerson} placeRef={ghostRef} />}

      {pending && pendingFrom && pendingTo && (
        <TypePickerDialog
          from={pendingFrom}
          to={pendingTo}
          types={sortedTypes}
          existingTypeIds={existingForPending.ids}
          existingSummary={existingForPending.summary}
          undoable={existingForPending.undoable}
          busy={busy}
          anchor={pending.anchor}
          previewFor={previewFor}
          onPick={(typeId) => void handlePick(typeId)}
          onClose={closePicker}
        />
      )}
    </div>
  );
}
