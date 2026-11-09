'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import PersonAvatar from './PersonPhoto';
import type { RawGraphPerson } from './graph/bubble-composition';

interface RelationshipTypeOption {
  id: string;
  label: string;
}

interface GraphLoosePeopleProps {
  people: RawGraphPerson[];
  open: boolean;
  onToggle: () => void;
  /** A group filter is active, so some of these may be connected to people outside it. */
  filterActive: boolean;
  /** A relationship was set: the graph loads the network again. */
  onAssigned: () => void;
}

export default function GraphLoosePeople({
  people,
  open,
  onToggle,
  filterActive,
  onAssigned,
}: GraphLoosePeopleProps) {
  const t = useTranslations('dashboard.graph.loose');
  const [types, setTypes] = useState<RelationshipTypeOption[] | null>(null);
  const [typesFailed, setTypesFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  // The relationship types are only needed once the list is opened
  useEffect(() => {
    if (!open || types !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/relationship-types');
        if (!response.ok) throw new Error('Failed to load relationship types');
        const data = await response.json() as { relationshipTypes: RelationshipTypeOption[] };
        if (!cancelled) setTypes(data.relationshipTypes);
      } catch {
        if (!cancelled) setTypesFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, types]);

  const visible = people.filter((p) => !doneIds.has(p.id));
  if (visible.length === 0) return null;

  const assign = async (person: RawGraphPerson, relationshipTypeId: string) => {
    if (!relationshipTypeId) return;
    setBusyId(person.id);
    try {
      const response = await fetch('/api/people/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setRelationship',
          personIds: [person.id],
          relationshipTypeId,
        }),
      });
      if (!response.ok) throw new Error('Failed to set relationship');
      setDoneIds((prev) => new Set(prev).add(person.id));
      toast.success(t('assigned', { name: person.label }));
      onAssigned();
    } catch {
      toast.error(t('assignFailed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-4 rounded-lg border border-border bg-surface-elevated">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="graph-loose-people"
        className="flex w-full min-h-11 items-center justify-between gap-3 px-4 py-2 text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {t('title')}
          <span className="inline-flex min-w-6 justify-center rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted border border-border">
            {visible.length}
          </span>
        </span>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div id="graph-loose-people" className="max-h-[40dvh] overflow-y-auto border-t border-border px-4 py-3">
          <p className="text-sm text-muted mb-3">{t('description')}</p>
          {filterActive && <p className="text-xs text-muted mb-3">{t('filterNote')}</p>}
          {typesFailed && <p className="text-sm text-warning mb-3">{t('typesFailed')}</p>}
          {types !== null && types.length === 0 && (
            <p className="text-sm text-muted mb-3">
              {t('noTypes')}{' '}
              <Link href="/relationship-types/new" className="text-primary hover:underline">
                {t('createType')}
              </Link>
            </p>
          )}
          <ul className="space-y-2">
            {visible.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/people/${person.id}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm font-medium text-foreground hover:text-primary"
                >
                  <PersonAvatar personId={person.id} name={person.label} photo={person.photo} size={32} />
                  <span className="truncate">{person.label}</span>
                </Link>
                <select
                  value=""
                  disabled={busyId === person.id || types === null || types.length === 0}
                  onChange={(event) => assign(person, event.target.value)}
                  aria-label={t('assignAriaLabel', { name: person.label })}
                  className="min-h-11 sm:min-h-0 w-full sm:w-auto px-3 py-2 text-sm border border-border rounded-lg bg-surface text-foreground focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                >
                  <option value="">{t('assignPlaceholder')}</option>
                  {(types ?? []).map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
