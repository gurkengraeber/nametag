import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/locales/en.json';
import ReminderSummary from '@/components/settings/ReminderSummary';
import { activeReminderChannels } from '@/components/settings/reminderChannels';

const base = {
  emailAvailable: true,
  emailEnabled: true,
  pushAvailable: true,
  activePushDevices: 0,
  activeDestinations: 0,
};

describe('activeReminderChannels', () => {
  it('counts email only when the server can send it and it is on', () => {
    expect(activeReminderChannels(base)).toEqual([{ kind: 'email' }]);
    expect(activeReminderChannels({ ...base, emailEnabled: false })).toEqual([]);
    expect(activeReminderChannels({ ...base, emailAvailable: false })).toEqual([]);
  });

  it('counts push devices only when push is configured', () => {
    expect(activeReminderChannels({ ...base, emailEnabled: false, activePushDevices: 2 })).toEqual([
      { kind: 'push', count: 2 },
    ]);
    expect(
      activeReminderChannels({ ...base, emailEnabled: false, pushAvailable: false, activePushDevices: 2 })
    ).toEqual([]);
  });

  it('lists every working channel in a stable order', () => {
    expect(
      activeReminderChannels({ ...base, activePushDevices: 1, activeDestinations: 3 }).map((c) => c.kind)
    ).toEqual(['email', 'push', 'destinations']);
  });
});

describe('ReminderSummary', () => {
  function renderSummary(props: typeof base) {
    return render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ReminderSummary {...props} />
      </NextIntlClientProvider>
    );
  }

  it('names the channels that will deliver', () => {
    renderSummary({ ...base, activePushDevices: 2 });
    expect(screen.getByRole('status')).toHaveTextContent('Reminders reach you by email and push on 2 devices.');
  });

  it('warns when nothing is on', () => {
    renderSummary({ ...base, emailEnabled: false });
    expect(screen.getByRole('status')).toHaveTextContent('No reminder channel is on');
  });
});
