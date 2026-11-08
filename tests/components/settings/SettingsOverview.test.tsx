import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/locales/en.json';
import SettingsOverview from '@/components/settings/SettingsOverview';

function renderOverview(isSaasMode = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SettingsOverview isSaasMode={isSaasMode} />
    </NextIntlClientProvider>
  );
}

describe('SettingsOverview', () => {
  it('lists every area as a link, grouped under headings', () => {
    renderOverview();
    expect(screen.getByRole('heading', { name: 'You' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Profile/ })).toHaveAttribute('href', '/settings/profile');
    expect(screen.getByRole('link', { name: /Trash/ })).toHaveAttribute('href', '/settings/trash');
  });

  it('hides billing outside SaaS mode and shows it inside', () => {
    const { unmount } = renderOverview(false);
    expect(screen.queryByRole('link', { name: /Billing/ })).not.toBeInTheDocument();
    unmount();
    renderOverview(true);
    expect(screen.getByRole('link', { name: /Billing/ })).toBeInTheDocument();
  });

  it('filters across all areas while typing, using keywords', async () => {
    const user = userEvent.setup();
    renderOverview();
    await user.type(screen.getByRole('searchbox'), 'password');
    expect(screen.getByRole('link', { name: /Security/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Trash/ })).not.toBeInTheDocument();
  });

  it('explains when nothing matches', async () => {
    const user = userEvent.setup();
    renderOverview();
    await user.type(screen.getByRole('searchbox'), 'qqqq');
    expect(screen.getByRole('status')).toHaveTextContent('No settings match "qqqq"');
  });
});
