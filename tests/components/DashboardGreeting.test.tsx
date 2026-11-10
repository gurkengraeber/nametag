import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../locales/en.json';
import DashboardGreeting from '../../components/DashboardGreeting';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('DashboardGreeting', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [6, 'Good morning, Sam'],
    [11, 'Good morning, Sam'],
    [12, 'Good afternoon, Sam'],
    [17, 'Good afternoon, Sam'],
    [18, 'Good evening, Sam'],
    [23, 'Good evening, Sam'],
  ])('greets by the browser hour %i', (hour, text) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, hour, 30));
    render(
      <Wrapper>
        <DashboardGreeting name="Sam" />
      </Wrapper>
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('renders a neutral hello on the server, which does not know the visitor hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 7, 0));
    const html = renderToString(
      <Wrapper>
        <DashboardGreeting name="Sam" />
      </Wrapper>
    );
    expect(html).toContain('Hello, Sam');
    expect(html).not.toContain('Good morning');
  });
});
