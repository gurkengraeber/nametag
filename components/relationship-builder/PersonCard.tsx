'use client';

import { memo, type PointerEvent as ReactPointerEvent } from 'react';
import PersonAvatar from '../PersonPhoto';
import type { BuilderPerson } from '@/lib/relationship-builder';

interface PersonCardProps {
  person: BuilderPerson;
  /** Chosen as the first person by tapping. */
  selected: boolean;
  /** The card currently being dragged. */
  dragging: boolean;
  /** The card under the dragged one. */
  dropTarget: boolean;
  connectionsLabel: string;
  ariaLabel: string;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, personId: string) => void;
  onActivate: (personId: string) => void;
}

/**
 * One person as a compact card. A real button, so Tab, Enter and Space pick it
 * the same way a tap does; the pointer handlers add dragging on top.
 */
function PersonCard({
  person,
  selected,
  dragging,
  dropTarget,
  connectionsLabel,
  ariaLabel,
  onPointerDown,
  onActivate,
}: PersonCardProps) {
  const highlighted = selected || dropTarget;

  return (
    <button
      type="button"
      data-person-id={person.id}
      aria-pressed={selected}
      aria-label={ariaLabel}
      onPointerDown={(event) => onPointerDown(event, person.id)}
      // The avatar image would otherwise start a native image drag and cancel ours.
      onDragStart={(event) => event.preventDefault()}
      onClick={() => onActivate(person.id)}
      className={[
        'group flex flex-col gap-1.5 w-full min-h-16 px-3 py-2.5 text-left rounded-lg border bg-surface',
        'select-none [-webkit-touch-callout:none] cursor-grab',
        'transition-colors motion-reduce:transition-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        highlighted
          ? 'border-primary ring-2 ring-primary bg-primary/10'
          : 'border-border hover:border-primary/60 hover:bg-surface-elevated',
        dragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <span className="flex items-center gap-2 min-w-0">
        <PersonAvatar personId={person.id} name={person.displayName} photo={person.photo} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground leading-snug line-clamp-2 break-words">
            {person.displayName}
          </span>
          {person.secondary && (
            <span className="block text-xs text-muted truncate">{person.secondary}</span>
          )}
        </span>
      </span>
      <span className="block text-xs text-muted truncate">
        {person.relationshipLabel ? `${person.relationshipLabel} · ${connectionsLabel}` : connectionsLabel}
      </span>
    </button>
  );
}

export default memo(PersonCard);
