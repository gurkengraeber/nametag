import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../locales/en.json';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/PersonPhoto', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

import DashboardUpcomingEvents, { type DashboardEventItem } from '../../components/DashboardUpcomingEvents';

const event: DashboardEventItem = {
  id: 'e-1',
  personId: 'p-1',
  personName: 'Anna Berg',
  personPhoto: null,
  title: 'Time to catch up',
  dueLabel: 'Today',
  dateLabel: 'Nov 9',
  urgency: 'soon',
  canMarkContacted: true,
};

function renderEvents(events: DashboardEventItem[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DashboardUpcomingEvents events={events} />
    </NextIntlClientProvider>,
  );
}

describe('DashboardUpcomingEvents', () => {
  it('renders nothing without events', () => {
    const { container } = renderEvents([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the icon-only contacted button at least 44px wide on narrow screens', () => {
    renderEvents([event]);
    const button = screen.getByRole('button', { name: /Anna Berg/ });
    expect(button).toHaveClass('min-h-11', 'min-w-11');
  });

  it('offers no contacted button for other events', () => {
    renderEvents([{ ...event, canMarkContacted: false }]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
