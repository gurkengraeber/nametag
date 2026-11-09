interface PushRouter {
  push: (href: string) => void;
}

/**
 * Navigates in-app. While offline a client-side transition freezes the screen
 * (see OfflineNavigationGuard), so a full page load is used instead and the
 * service worker can serve the offline page.
 */
export function navigateTo(router: PushRouter, href: string): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    window.location.assign(href);
    return;
  }
  router.push(href);
}
