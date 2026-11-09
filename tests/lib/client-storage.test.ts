import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearNametagStorage, storageKey } from '@/lib/client-storage';

describe('client storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('builds keys as nametag:<area>:<userId>', () => {
    expect(storageKey('recent-people', 'u1')).toBe('nametag:recent-people:u1');
  });

  it('removes every nametag key from both storages and nothing else', () => {
    window.localStorage.setItem('nametag:recent-people:u1', 'x');
    window.localStorage.setItem('nametag:journal-draft:u1', 'x');
    window.localStorage.setItem('theme', 'dark');
    window.sessionStorage.setItem('nametag:something:u1', 'x');
    window.sessionStorage.setItem('backLink:/people', '/people');

    clearNametagStorage();

    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(window.sessionStorage.length).toBe(1);
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => clearNametagStorage()).not.toThrow();
  });
});
