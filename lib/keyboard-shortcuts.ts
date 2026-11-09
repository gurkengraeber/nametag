/**
 * Global single-key shortcuts. Kept free of React so the key handling can be
 * tested on its own.
 *
 * Letters are matched by physical key position (`code`), so they keep working
 * on layouts that do not type Latin letters. Punctuation is matched by `key`
 * because its position differs between layouts.
 */
export type ShortcutAction =
  | { type: 'search' }
  | { type: 'new-person' }
  | { type: 'help' }
  | { type: 'go'; href: string };

export interface ShortcutKeyEvent {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export interface ShortcutState {
  /** True right after "g", while waiting for the destination letter. */
  pendingGo: boolean;
}

export const INITIAL_SHORTCUT_STATE: ShortcutState = { pendingGo: false };

/** How long "g" waits for the second key. */
export const GO_TIMEOUT_MS = 1500;

export const GO_DESTINATIONS: ReadonlyArray<{ letter: string; href: string; labelKey: string }> = [
  { letter: 'd', href: '/dashboard', labelKey: 'dashboard' },
  { letter: 'p', href: '/people', labelKey: 'people' },
  { letter: 'g', href: '/groups', labelKey: 'groups' },
  { letter: 'm', href: '/map', labelKey: 'map' },
  { letter: 'j', href: '/journal', labelKey: 'journal' },
  { letter: 'r', href: '/relationship-types', labelKey: 'relationshipTypes' },
];

/** The letter for a key press, from its position when there is one. */
function letterOf(event: ShortcutKeyEvent): string {
  if (event.code && /^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3).toLowerCase();
  }
  return event.key.length === 1 ? event.key.toLowerCase() : '';
}

/**
 * True when a key press belongs to a text field and must not trigger shortcuts.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(type);
  }
  return false;
}

export interface ShortcutResult {
  state: ShortcutState;
  action: ShortcutAction | null;
}

/**
 * Feeds one key press into the shortcut state machine. Presses with Ctrl, Meta
 * or Alt are never ours; they belong to the browser and the system.
 */
export function handleShortcutKey(state: ShortcutState, event: ShortcutKeyEvent): ShortcutResult {
  const idle: ShortcutState = { pendingGo: false };

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return { state: idle, action: null };
  }

  if (event.key === '?') {
    return { state: idle, action: { type: 'help' } };
  }

  // Letters with Shift are capitals or other layers; leave them alone.
  if (event.shiftKey) {
    return { state: idle, action: null };
  }

  if (state.pendingGo) {
    const letter = letterOf(event);
    const destination = GO_DESTINATIONS.find((entry) => entry.letter === letter);
    return { state: idle, action: destination ? { type: 'go', href: destination.href } : null };
  }

  if (event.key === '/') {
    return { state: idle, action: { type: 'search' } };
  }

  const letter = letterOf(event);
  if (letter === 'n') return { state: idle, action: { type: 'new-person' } };
  if (letter === 'g') return { state: { pendingGo: true }, action: null };

  return { state: idle, action: null };
}
