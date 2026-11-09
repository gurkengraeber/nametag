'use client';

import { useLocale, useTranslations } from 'next-intl';
import { activeReminderChannels, type ReminderChannelInput } from './reminderChannels';

/**
 * One sentence at the top of the notification settings that answers the real
 * question: will a reminder reach me, and where? Warns when the answer is no.
 */
export default function ReminderSummary(props: ReminderChannelInput) {
  const t = useTranslations('settings.notifications.summary');
  const locale = useLocale();
  const channels = activeReminderChannels(props);

  if (channels.length === 0) {
    return (
      <div role="status" className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded-lg">
        {t('none')}
      </div>
    );
  }

  const labels = channels.map((channel) => {
    if (channel.kind === 'email') return t('email');
    if (channel.kind === 'push') return t('push', { count: channel.count });
    return t('destinations', { count: channel.count });
  });
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(labels);

  return (
    <div role="status" className="bg-surface shadow rounded-lg px-6 py-4 text-foreground">
      {t('active', { channels: list })}
    </div>
  );
}
