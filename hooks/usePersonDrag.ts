'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  LONG_PRESS_MS,
  LONG_PRESS_TOLERANCE_PX,
  autoScrollDelta,
  exceedsDragThreshold,
  findCardAt,
  findPersonIdAt,
} from '@/lib/relationship-builder';

export interface DragState {
  sourceId: string;
  /** The card under the pointer, never the source itself. */
  overId: string | null;
}

interface Session {
  pointerId: number;
  pointerType: string;
  sourceId: string;
  originX: number;
  originY: number;
  x: number;
  y: number;
  active: boolean;
  overId: string | null;
  longPressTimer: number | null;
  scrollFrame: number | null;
  captureEl: HTMLElement;
}

interface UsePersonDragOptions {
  enabled: boolean;
  /** Called when a card is released over another card. */
  onDrop: (sourceId: string, targetId: string, targetEl: HTMLElement) => void;
}

/**
 * Pointer-event drag for person cards. Works with mouse, pen and touch (HTML5
 * drag and drop does not exist on phones).
 *
 * - Mouse and pen: a drag starts once the pointer moved a few pixels, so a
 *   plain click still selects the card.
 * - Touch: a drag starts after the finger rested on the card for a moment. A
 *   finger that moves first is a scroll and is left alone, so the list keeps
 *   scrolling normally. Once the drag is active the page is kept from
 *   scrolling by cancelling touchmove.
 *
 * The ghost card follows the pointer through `ghostRef` (direct DOM writes, so
 * moving does not re-render 200 cards). React state only changes when the drag
 * starts or ends and when the card under the pointer changes.
 */
export function usePersonDrag({ enabled, onDrop }: UsePersonDragOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);
  const onDropRef = useRef(onDrop);
  const teardownRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const placeGhost = useCallback((el: HTMLDivElement | null) => {
    ghostRef.current = el;
    if (el) {
      const { x, y } = positionRef.current;
      el.style.transform = `translate3d(${x}px, ${y - 20}px, 0) translate(-50%, -100%)`;
    }
  }, []);

  // A non-passive listener has to exist before the touch starts, otherwise
  // browsers treat the first move as a scroll. It only cancels while a drag is
  // active, so ordinary scrolling is untouched.
  useEffect(() => {
    if (!enabled) return;
    const blockScroll = (event: TouchEvent) => {
      if (sessionRef.current?.active && event.cancelable) event.preventDefault();
    };
    window.addEventListener('touchmove', blockScroll, { passive: false });
    return () => window.removeEventListener('touchmove', blockScroll);
  }, [enabled]);

  const cardUnder = useCallback((x: number, y: number): Element | null => {
    if (typeof document.elementFromPoint !== 'function') return null;
    return document.elementFromPoint(x, y);
  }, []);

  const updateOver = useCallback(
    (session: Session) => {
      const id = findPersonIdAt(cardUnder(session.x, session.y));
      const overId = id && id !== session.sourceId ? id : null;
      if (overId !== session.overId) {
        session.overId = overId;
        setDrag({ sourceId: session.sourceId, overId });
      }
    },
    [cardUnder]
  );

  const start = useCallback(
    (event: ReactPointerEvent<HTMLElement>, personId: string) => {
      if (!enabled || !event.isPrimary) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // A leftover session (a pointerup that never arrived) must not block new drags.
      teardownRef.current?.();

      const session: Session = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        sourceId: personId,
        originX: event.clientX,
        originY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        active: false,
        overId: null,
        longPressTimer: null,
        scrollFrame: null,
        captureEl: event.currentTarget,
      };
      sessionRef.current = session;
      positionRef.current = { x: event.clientX, y: event.clientY };

      const activate = () => {
        if (sessionRef.current !== session || session.active) return;
        session.active = true;
        try {
          if (typeof session.captureEl.setPointerCapture === 'function') {
            session.captureEl.setPointerCapture(session.pointerId);
          }
        } catch {
          // Capture can fail for a pointer that already ended; the window listeners still work.
        }
        document.body.style.userSelect = 'none';
        document.body.style.setProperty('-webkit-user-select', 'none');
        setDrag({ sourceId: session.sourceId, overId: null });
        try {
          if (session.pointerType === 'touch') navigator.vibrate?.(10);
        } catch {
          // Haptics are a nicety.
        }
        const loop = () => {
          if (sessionRef.current !== session || !session.active) return;
          const delta = autoScrollDelta(session.y, window.innerHeight);
          if (delta !== 0) {
            window.scrollBy(0, delta);
            updateOver(session);
          }
          session.scrollFrame = window.requestAnimationFrame(loop);
        };
        session.scrollFrame = window.requestAnimationFrame(loop);
      };

      const onMove = (e: PointerEvent) => {
        if (e.pointerId !== session.pointerId) return;
        session.x = e.clientX;
        session.y = e.clientY;
        positionRef.current = { x: e.clientX, y: e.clientY };
        const dx = e.clientX - session.originX;
        const dy = e.clientY - session.originY;

        if (!session.active) {
          if (session.pointerType === 'touch') {
            // Moved before the long press fired: this is a scroll, not a drag.
            if (Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE_PX) teardown();
          } else if (exceedsDragThreshold(dx, dy)) {
            activate();
          }
          if (!session.active) return;
        }

        const ghost = ghostRef.current;
        if (ghost) {
          ghost.style.transform = `translate3d(${e.clientX}px, ${e.clientY - 20}px, 0) translate(-50%, -100%)`;
        }
        updateOver(session);
      };

      const onUp = (e: PointerEvent) => {
        if (e.pointerId !== session.pointerId) return;
        const wasActive = session.active;
        const targetEl = findCardAt(cardUnder(e.clientX, e.clientY));
        const targetId = targetEl?.getAttribute('data-person-id') ?? null;
        teardown();
        if (!wasActive) return;
        // The click that follows a drag must not select the card it ended on.
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        if (targetEl && targetId && targetId !== session.sourceId) {
          onDropRef.current(session.sourceId, targetId, targetEl);
        }
      };

      const onCancel = (e: PointerEvent) => {
        if (e.pointerId === session.pointerId) teardown();
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && session.active) teardown();
      };

      const onContextMenu = (e: Event) => {
        if (session.pointerType === 'touch') e.preventDefault();
      };

      const teardown = () => {
        if (sessionRef.current !== session) return;
        if (session.longPressTimer !== null) window.clearTimeout(session.longPressTimer);
        if (session.scrollFrame !== null) window.cancelAnimationFrame(session.scrollFrame);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('contextmenu', onContextMenu);
        try {
          if (
            typeof session.captureEl.hasPointerCapture === 'function' &&
            session.captureEl.hasPointerCapture(session.pointerId)
          ) {
            session.captureEl.releasePointerCapture(session.pointerId);
          }
        } catch {
          // Already released.
        }
        document.body.style.userSelect = '';
        document.body.style.removeProperty('-webkit-user-select');
        sessionRef.current = null;
        teardownRef.current = null;
        setDrag(null);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey);
      window.addEventListener('contextmenu', onContextMenu);
      teardownRef.current = teardown;

      if (session.pointerType === 'touch') {
        session.longPressTimer = window.setTimeout(activate, LONG_PRESS_MS);
      }
    },
    [enabled, cardUnder, updateOver]
  );

  // Leaving the page mid-drag must not leave listeners or a locked body behind.
  useEffect(() => () => teardownRef.current?.(), []);

  /** True once for the click that directly follows a finished drag. */
  const consumeClick = useCallback((): boolean => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return { drag, ghostRef: placeGhost, start, consumeClick };
}
