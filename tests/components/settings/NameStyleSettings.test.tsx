import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/locales/en.json';
import NameStyleSettings from '@/components/settings/NameStyleSettings';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderSettings() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <NameStyleSettings currentOrder="WESTERN" currentFormat="FULL" />
    </NextIntlClientProvider>
  );
}

describe('NameStyleSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  });

  it('shows the example for the current settings', () => {
    renderSettings();
    expect(screen.getByTestId('name-preview-page')).toHaveTextContent("Maria 'Mia' Garcia");
  });

  it('updates the example immediately and saves the new order', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('radio', { name: /Eastern/ }));
    expect(screen.getByTestId('name-preview-page')).toHaveTextContent("Garcia 'Mia' Maria");
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/user/name-order',
      expect.objectContaining({ body: JSON.stringify({ nameOrder: 'EASTERN' }) })
    ));
    const { toast } = await import('sonner');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Name display order updated successfully'));
  });

  it('reverts the example and reports the error when saving fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Nope' }), { status: 400 }));
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('radio', { name: /Short/ }));
    const { toast } = await import('sonner');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nope'));
    expect(screen.getByTestId('name-preview-compact')).toHaveTextContent("Maria 'Mia' Garcia");
  });
});
