'use client';

import PersonAvatar from '../PersonPhoto';
import type { BuilderPerson } from '@/lib/relationship-builder';

interface DragGhostProps {
  person: BuilderPerson;
  /** Receives the element so the drag hook can move it without re-rendering. */
  placeRef: (el: HTMLDivElement | null) => void;
}

/** The card that follows the pointer. Never takes pointer events, so the hit test sees what is below it. */
export default function DragGhost({ person, placeRef }: DragGhostProps) {
  return (
    <div
      ref={placeRef}
      aria-hidden="true"
      data-testid="drag-ghost"
      className="fixed left-0 top-0 z-[60] pointer-events-none flex items-center gap-2 max-w-[14rem] px-3 py-2 rounded-lg border border-primary bg-surface-elevated shadow-lg opacity-95 will-change-transform"
    >
      <PersonAvatar personId={person.id} name={person.displayName} photo={person.photo} size={28} loading="eager" />
      <span className="text-sm font-medium text-foreground truncate">{person.displayName}</span>
    </div>
  );
}
