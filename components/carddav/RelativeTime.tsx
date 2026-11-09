'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { formatDateTime } from '@/lib/date-format';
import { formatRelativeTime } from '@/lib/carddav-ui/relative-time';

interface RelativeTimeProps {
  date: string | Date;
  className?: string;
}

/**
 * "5 minutes ago" with the exact time as a tooltip. The first render shows the
 * exact time so server and browser agree; the relative text takes over after mount.
 */
export default function RelativeTime({ date, className }: RelativeTimeProps) {
  const locale = useLocale();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock only exists in the browser
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const exact = formatDateTime(date);
  const iso = new Date(date).toISOString();

  return (
    <time dateTime={iso} title={exact} className={className}>
      {now === null ? exact : formatRelativeTime(date, now, locale)}
    </time>
  );
}
