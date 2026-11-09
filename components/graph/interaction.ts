// components/graph/interaction.ts

export interface WheelInfo {
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * Whether a mouse wheel turn should zoom the graph. Embedded graphs (the person
 * page, the dashboard card) only zoom while Ctrl or Cmd is held, otherwise the
 * wheel scrolls the page and the graph never hijacks it. Trackpad pinch gestures
 * arrive as wheel events with ctrlKey set, so they zoom as well. Full screen has
 * nothing to scroll, so the wheel always zooms there.
 */
export function shouldZoomOnWheel({ ctrlKey, metaKey }: WheelInfo, fullscreen: boolean): boolean {
  return fullscreen || ctrlKey || metaKey;
}

/** touch-action for the canvas: embedded graphs let a vertical swipe scroll the page. */
export function canvasTouchAction(fullscreen: boolean): 'none' | 'pan-y' {
  return fullscreen ? 'none' : 'pan-y';
}
