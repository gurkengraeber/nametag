'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { navigateTo } from '@/lib/client-navigation';
import {
  GO_DESTINATIONS,
  GO_TIMEOUT_MS,
  INITIAL_SHORTCUT_STATE,
  handleShortcutKey,
  isTypingTarget,
  type ShortcutState,
} from '@/lib/keyboard-shortcuts';

interface KeyboardShortcutsProps {
  /** Puts the cursor in the search field, wherever it is on screen. */
  onFocusSearch: () => void;
  helpOpen: boolean;
  onHelpOpenChange: (open: boolean) => void;
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 text-xs font-medium text-foreground bg-background border border-border rounded">
      {children}
    </kbd>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 shrink-0 text-xs text-muted">{children}</dd>
    </div>
  );
}

/**
 * Single-key shortcuts for the whole signed-in app, plus the help dialog that
 * lists them. Nothing fires while a text field has focus or a dialog is open.
 */
export default function KeyboardShortcuts({ onFocusSearch, helpOpen, onHelpOpenChange }: KeyboardShortcutsProps) {
  const router = useRouter();
  const t = useTranslations('nav.shortcuts');
  const tNav = useTranslations('nav');

  // The handler is bound once; these refs keep it pointed at the latest props.
  const latest = useRef({ router, onFocusSearch, helpOpen, onHelpOpenChange });
  useEffect(() => {
    latest.current = { router, onFocusSearch, helpOpen, onHelpOpenChange };
  });

  useEffect(() => {
    let state: ShortcutState = INITIAL_SHORTCUT_STATE;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      state = INITIAL_SHORTCUT_STATE;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if (isTypingTarget(event.target)) {
        reset();
        return;
      }
      // Another dialog (the mobile menu, a confirmation) owns the keyboard.
      // The help dialog itself is allowed through so "?" can close it again.
      if (!latest.current.helpOpen && document.querySelector('[aria-modal="true"]')) {
        reset();
        return;
      }

      const result = handleShortcutKey(state, event);
      state = result.state;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (state.pendingGo) {
        timer = setTimeout(reset, GO_TIMEOUT_MS);
      }

      const { action } = result;
      if (!action) return;

      switch (action.type) {
        case 'search':
          event.preventDefault();
          latest.current.onFocusSearch();
          break;
        case 'new-person':
          event.preventDefault();
          navigateTo(latest.current.router, '/people/new');
          break;
        case 'help':
          event.preventDefault();
          latest.current.onHelpOpenChange(!latest.current.helpOpen);
          break;
        case 'go':
          event.preventDefault();
          navigateTo(latest.current.router, action.href);
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      reset();
    };
  }, []);

  return (
    <Modal
      isOpen={helpOpen}
      onClose={() => onHelpOpenChange(false)}
      title={t('title')}
      size="sm"
      closeAriaLabel={t('close')}
    >
      <p className="text-sm text-muted mb-4">{t('description')}</p>

      <dl className="divide-y divide-border">
        <Row label={t('search')}>
          <Key>/</Key>
          <span>{t('or')}</span>
          <Key>Ctrl</Key>
          <Key>K</Key>
          <span>{t('or')}</span>
          <Key>{'⌘'}</Key>
          <Key>K</Key>
        </Row>
        <Row label={t('newPerson')}>
          <Key>N</Key>
        </Row>
        <Row label={t('help')}>
          <Key>?</Key>
        </Row>
      </dl>

      <h3 className="mt-5 mb-1 text-sm font-medium text-foreground">{t('goTo')}</h3>
      <dl className="divide-y divide-border">
        {GO_DESTINATIONS.map((destination) => (
          <Row key={destination.letter} label={tNav(destination.labelKey)}>
            <Key>G</Key>
            <span>{t('then')}</span>
            <Key>{destination.letter.toUpperCase()}</Key>
          </Row>
        ))}
      </dl>
    </Modal>
  );
}

