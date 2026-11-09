'use client';

import { useEffect } from 'react';
import { isLeavingPage } from './formState';

/**
 * Warns before the page is left while a form holds changes that were not saved.
 *
 * The browser's own prompt covers reloads, closing the tab and typed
 * addresses. In-app links are client side navigations that never fire that
 * prompt, so clicks on links are checked in the capture phase, before Next.js
 * handles them. Nothing is attached while the form is clean.
 */
export function useUnsavedChangesWarning(dirty: boolean, message: string): void {
  useEffect(() => {
    if (!dirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required by some browsers to show the prompt.
      event.returnValue = '';
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      if (!isLeavingPage(anchor.href, window.location)) return;

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
    };
  }, [dirty, message]);
}
