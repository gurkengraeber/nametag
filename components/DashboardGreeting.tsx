'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';

interface DashboardGreetingProps {
  name: string;
}

function subscribeNever(): () => void {
  return () => {};
}

function currentHour(): number {
  return new Date().getHours();
}

function serverHour(): null {
  return null;
}

/**
 * Time-of-day greeting based on the hour in the visitor's browser. The server
 * does not know that hour, so it renders a neutral hello until the page is live.
 */
export default function DashboardGreeting({ name }: DashboardGreetingProps) {
  const t = useTranslations('dashboard');
  const hour = useSyncExternalStore(subscribeNever, currentHour, serverHour);

  if (hour === null) return <>{t('greetingNeutral', { name })}</>;
  const key = hour < 12 ? 'greetingMorning' : hour < 18 ? 'greetingAfternoon' : 'greetingEvening';
  return <>{t(key, { name })}</>;
}
