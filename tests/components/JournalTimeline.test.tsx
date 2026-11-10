import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import JournalTimeline from '../../components/JournalTimeline';
import enMessages from '../../locales/en.json';
import { restoreTimezoneAfterEach, setProcessTimezone } from '../helpers/timezone';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const baseEntry = {
  id: 'entry-1',
  title: 'Coffee with Sara',
  body: 'Caught up over espresso.',
  people: [],
};

describe('JournalTimeline', () => {
  restoreTimezoneAfterEach();

  it('files a timed entry under the month of its local day', () => {
    setProcessTimezone('Europe/Madrid');
    // 00:30 on 1 March in Madrid, still 28 February in UTC.
    const entries = [{ ...baseEntry, date: '2026-02-28T23:30:00.000Z', hasTime: true }];
    render(
      <Wrapper>
        <JournalTimeline entries={entries} nameOrder="WESTERN" locale="en" />
      </Wrapper>
    );
    expect(screen.getByRole('region', { name: 'March 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'February 2026' })).toBeNull();
  });

  it('omits the time line when hasTime is false', () => {
    const entries = [{
      ...baseEntry,
      date: '2026-05-07T00:00:00.000Z',
      hasTime: false,
    }];
    render(
      <Wrapper>
        <JournalTimeline entries={entries} nameOrder="WESTERN" locale="en" />
      </Wrapper>
    );
    expect(screen.queryByText(/AM|PM|\d:\d{2}/)).toBeNull();
  });

  it('renders the locale-formatted time when hasTime is true', () => {
    const entries = [{
      ...baseEntry,
      // 14:30 UTC. The test runner's timezone affects the displayed local
      // time, but both 12h ("PM") and 24h (":30") forms include "30".
      date: '2026-05-07T14:30:00.000Z',
      hasTime: true,
    }];
    render(
      <Wrapper>
        <JournalTimeline entries={entries} nameOrder="WESTERN" locale="en" />
      </Wrapper>
    );
    expect(screen.getByText(/:30/)).toBeInTheDocument();
  });

  it('shows a relative day label for each entry', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00.000Z`;
    render(
      <Wrapper>
        <JournalTimeline entries={[{ ...baseEntry, date: iso, hasTime: false }]} nameOrder="WESTERN" locale="en" />
      </Wrapper>
    );
    expect(screen.getByText('yesterday')).toBeInTheDocument();
  });

  it('folds long entries and expands them on request', () => {
    const body = 'First sentence of a long note. ' + 'More words follow here. '.repeat(20) + 'THE VERY END';
    render(
      <Wrapper>
        <JournalTimeline
          entries={[{ ...baseEntry, body, date: '2026-05-07T00:00:00.000Z', hasTime: false }]}
          nameOrder="WESTERN"
          locale="en"
        />
      </Wrapper>
    );
    expect(screen.queryByText(/THE VERY END/)).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show full entry' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByText(/THE VERY END/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('has no fold button for short entries', () => {
    render(
      <Wrapper>
        <JournalTimeline
          entries={[{ ...baseEntry, date: '2026-05-07T00:00:00.000Z', hasTime: false }]}
          nameOrder="WESTERN"
          locale="en"
        />
      </Wrapper>
    );
    expect(screen.queryByRole('button', { name: 'Show full entry' })).toBeNull();
  });

  it('highlights the search term in the title', () => {
    const { container } = render(
      <Wrapper>
        <JournalTimeline
          entries={[{ ...baseEntry, date: '2026-05-07T00:00:00.000Z', hasTime: false }]}
          nameOrder="WESTERN"
          locale="en"
          searchQuery="coffee"
          hasFilters
        />
      </Wrapper>
    );
    expect(container.querySelector('mark')).toHaveTextContent('Coffee');
    expect(screen.getByText('1 entry')).toBeInTheDocument();
  });

  it('offers to clear filters and write an entry when nothing matches', () => {
    render(
      <Wrapper>
        <JournalTimeline entries={[]} nameOrder="WESTERN" locale="en" hasFilters personIds={['p1', 'p2']} />
      </Wrapper>
    );
    expect(screen.getByText('No entries match these filters')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/journal');
    expect(screen.getByRole('link', { name: 'Write an entry' })).toHaveAttribute('href', '/journal/new?person=p1,p2');
  });

  it('keeps the first-entry prompt when the journal is empty and unfiltered', () => {
    render(
      <Wrapper>
        <JournalTimeline entries={[]} nameOrder="WESTERN" locale="en" />
      </Wrapper>
    );
    expect(screen.getByText('No journal entries yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Write your first entry' })).toHaveAttribute('href', '/journal/new');
  });
});
