'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  computePopoverPosition,
  type BuilderPerson,
  type BuilderType,
  type Rect,
} from '@/lib/relationship-builder';

const WIDE_QUERY = '(min-width: 640px)';
const PANEL_WIDTH = 360;
const PANEL_MAX_HEIGHT = 440;
/** Past this many types the picker gets its own search field. */
const SEARCH_THRESHOLD = 6;

function subscribeWide(callback: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function isWide(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(WIDE_QUERY).matches;
}

interface TypePickerDialogProps {
  from: BuilderPerson;
  to: BuilderPerson;
  /** Every type, recently used first. */
  types: BuilderType[];
  /** Types already stored as "from is to's ..."; they cannot be created twice. */
  existingTypeIds: string[];
  /** "Anna is Ben's friend", or null when the two are not connected yet. */
  existingSummary: string | null;
  /** False when the pair already has rows the delete route could mix up. */
  undoable: boolean;
  busy: boolean;
  /** The target card; on wide screens the picker opens next to it. */
  anchor: Rect | null;
  previewFor: (typeId: string) => string;
  onPick: (typeId: string) => void;
  onClose: () => void;
}

/**
 * Asks which relationship the dropped or tapped pair gets. A bottom sheet on
 * phones, a small popover next to the target card on wide screens.
 */
export default function TypePickerDialog({
  from,
  to,
  types,
  existingTypeIds,
  existingSummary,
  undoable,
  busy,
  anchor,
  previewFor,
  onPick,
  onClose,
}: TypePickerDialogProps) {
  const t = useTranslations('relationshipBuilder.dialog');
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);

  useFocusTrap(panelRef, true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const existing = useMemo(() => new Set(existingTypeIds), [existingTypeIds]);
  const needle = query.trim().toLowerCase();
  const visible = needle ? types.filter((type) => type.label.toLowerCase().includes(needle)) : types;
  const firstPickable = visible.find((type) => !existing.has(type.id));

  const style = useMemo<CSSProperties | undefined>(() => {
    if (!wide || !anchor) return undefined;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const height = Math.min(PANEL_MAX_HEIGHT, viewport.height - 16);
    const position = computePopoverPosition(anchor, viewport, { width: PANEL_WIDTH, height });
    return {
      left: position.left,
      top: position.top,
      bottom: position.bottom,
      width: PANEL_WIDTH,
      maxHeight: height,
    };
  }, [wide, anchor]);

  const preview = previewId ? previewFor(previewId) : null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 sm:bg-black/20" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-dialog-title"
        style={style}
        className={
          style
            ? 'absolute flex flex-col bg-surface border border-border rounded-lg shadow-lg p-4'
            : 'absolute inset-x-0 bottom-0 flex flex-col max-h-[85vh] bg-surface border-t border-border rounded-t-2xl shadow-lg p-4 pb-[calc(theme(spacing.4)+env(safe-area-inset-bottom))]'
        }
      >
        <h3 id="connect-dialog-title" className="text-base font-semibold text-foreground break-words">
          {t('title', { from: from.displayName, to: to.displayName })}
        </h3>
        <p className="text-sm text-muted mt-0.5 break-words">
          {t('sentence', { from: from.displayName, to: to.displayName })}
        </p>

        {existingSummary && (
          <p className="mt-2 text-sm text-foreground bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            {t('alreadyConnected', { summary: existingSummary })}
          </p>
        )}

        {existingSummary && !undoable && (
          <p className="mt-2 text-xs text-muted break-words">{t('cannotUndo')}</p>
        )}

        {types.length > SEARCH_THRESHOLD && (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && firstPickable && !busy) {
                event.preventDefault();
                onPick(firstPickable.id);
              }
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="mt-3 w-full px-3 py-2 min-h-11 sm:min-h-0 text-base sm:text-sm border border-border rounded-lg bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        <div
          role="group"
          aria-label={t('typesLabel')}
          className="mt-3 flex flex-wrap gap-2 overflow-y-auto min-h-0"
        >
          {visible.length === 0 && <p className="text-sm text-muted">{t('noTypes')}</p>}
          {visible.map((type) => {
            const used = existing.has(type.id);
            return (
              <button
                key={type.id}
                type="button"
                disabled={busy || used}
                onClick={() => onPick(type.id)}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setPreviewId(type.id);
                }}
                onPointerLeave={() => setPreviewId(null)}
                onFocus={() => setPreviewId(type.id)}
                onBlur={() => setPreviewId(null)}
                aria-label={used ? `${type.label}, ${t('alreadyLinked')}` : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-11 sm:min-h-0 sm:py-1.5 text-sm font-medium rounded-full border border-border text-foreground hover:border-primary hover:text-primary transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {type.color && (
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: type.color }}
                  />
                )}
                {type.label}
                {used && (
                  <svg className="w-4 h-4 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted min-h-4 break-words" aria-live="polite">
          {preview ?? ''}
        </p>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-11 sm:min-h-0 text-sm font-semibold rounded-lg border border-border bg-surface text-muted hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
