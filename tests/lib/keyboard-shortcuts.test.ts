import { describe, it, expect } from 'vitest';
import {
  INITIAL_SHORTCUT_STATE,
  handleShortcutKey,
  isTypingTarget,
  type ShortcutState,
} from '@/lib/keyboard-shortcuts';

const press = (state: ShortcutState, key: string, extra: Record<string, unknown> = {}) =>
  handleShortcutKey(state, { key, code: /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : undefined, ...extra });

describe('handleShortcutKey', () => {
  it('opens search with a slash', () => {
    expect(press(INITIAL_SHORTCUT_STATE, '/').action).toEqual({ type: 'search' });
  });

  it('starts a new person with n', () => {
    expect(press(INITIAL_SHORTCUT_STATE, 'n').action).toEqual({ type: 'new-person' });
  });

  it('shows help with a question mark, even though it needs Shift', () => {
    expect(press(INITIAL_SHORTCUT_STATE, '?', { shiftKey: true }).action).toEqual({ type: 'help' });
  });

  it('waits for a second key after g', () => {
    const first = press(INITIAL_SHORTCUT_STATE, 'g');
    expect(first.action).toBeNull();
    expect(first.state.pendingGo).toBe(true);
  });

  it.each([
    ['d', '/dashboard'],
    ['p', '/people'],
    ['g', '/groups'],
    ['m', '/map'],
    ['j', '/journal'],
    ['r', '/relationship-types'],
  ])('goes to the right page for g then %s', (letter, href) => {
    const second = press({ pendingGo: true }, letter);
    expect(second.action).toEqual({ type: 'go', href });
    expect(second.state.pendingGo).toBe(false);
  });

  it('drops the pending g on an unknown key', () => {
    const result = press({ pendingGo: true }, 'x');
    expect(result.action).toBeNull();
    expect(result.state.pendingGo).toBe(false);
  });

  it('does not treat n as a shortcut right after g', () => {
    expect(press({ pendingGo: true }, 'n').action).toBeNull();
  });

  it('leaves browser and system shortcuts alone', () => {
    expect(press(INITIAL_SHORTCUT_STATE, 'n', { ctrlKey: true }).action).toBeNull();
    expect(press(INITIAL_SHORTCUT_STATE, 'n', { metaKey: true }).action).toBeNull();
    expect(press(INITIAL_SHORTCUT_STATE, '/', { altKey: true }).action).toBeNull();
  });

  it('ignores capital letters', () => {
    expect(press(INITIAL_SHORTCUT_STATE, 'N', { shiftKey: true }).action).toBeNull();
  });

  it('matches letters by key position on other keyboard layouts', () => {
    const result = handleShortcutKey(INITIAL_SHORTCUT_STATE, { key: 'т', code: 'KeyN' });
    expect(result.action).toEqual({ type: 'new-person' });
  });

  it('ignores keys without a shortcut', () => {
    expect(press(INITIAL_SHORTCUT_STATE, 'q').action).toBeNull();
    expect(press(INITIAL_SHORTCUT_STATE, 'Enter').action).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('is true for text fields and editable content', () => {
    const input = document.createElement('input');
    expect(isTypingTarget(input)).toBe(true);
    input.type = 'search';
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
  });

  it('is false for buttons, checkboxes and plain elements', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isTypingTarget(checkbox)).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
