import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EmptyState from '@/components/EmptyState';

describe('EmptyState', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders title, description and one action', () => {
    render(
      <EmptyState title="No people yet" description="Add someone." actionLabel="Add a person" actionHref="/people/new" />
    );

    expect(screen.getByRole('heading', { name: 'No people yet' })).toBeInTheDocument();
    expect(screen.getByText('Add someone.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a person' })).toHaveAttribute('href', '/people/new');
  });

  it('offers a second way forward next to the first', () => {
    render(
      <EmptyState
        title="No people yet"
        description="Add someone."
        actionLabel="Add a person"
        actionHref="/people/new"
        secondaryActionLabel="Import contacts"
        secondaryActionHref="/settings/carddav"
      />
    );

    expect(screen.getByRole('link', { name: 'Import contacts' })).toHaveAttribute('href', '/settings/carddav');
    expect(screen.getByRole('link', { name: 'Add a person' })).toBeInTheDocument();
  });

  it('works without an icon or any action', () => {
    render(<EmptyState title="Nothing here" description="Come back later." />);

    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('skips an action that has a label but no target', () => {
    render(<EmptyState title="T" description="D" actionLabel="Go" />);

    expect(screen.queryByRole('link', { name: 'Go' })).not.toBeInTheDocument();
  });

  it('renders an emoji or a custom icon', () => {
    const { rerender } = render(<EmptyState icon="x" title="T" description="D" />);
    expect(screen.getByText('x')).toBeInTheDocument();

    rerender(<EmptyState icon={<svg data-testid="custom" />} title="T" description="D" />);
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });
});
