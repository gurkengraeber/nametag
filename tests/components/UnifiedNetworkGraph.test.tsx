import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { Simulation } from 'd3-force';
import enMessages from '../../locales/en.json';

const created = vi.hoisted(() => ({ sims: [] as Array<{ stop: () => void }>, charges: [] as number[] }));

vi.mock('d3-force', async (importOriginal) => {
  const actual = await importOriginal<typeof import('d3-force')>();
  return {
    ...actual,
    forceSimulation: (...args: Parameters<typeof actual.forceSimulation>) => {
      const sim = actual.forceSimulation(...args);
      vi.spyOn(sim, 'stop');
      created.sims.push(sim);
      return sim;
    },
    forceManyBody: () => {
      const force = actual.forceManyBody();
      const strength = force.strength.bind(force);
      force.strength = ((value?: number) => {
        if (typeof value === 'number') created.charges.push(value);
        return strength(value as number);
      }) as typeof force.strength;
      return force;
    },
  };
});

import UnifiedNetworkGraph from '../../components/UnifiedNetworkGraph';

const graph = {
  nodes: [
    { id: 'user-1', label: 'You', groups: [], colors: [], isCenter: true },
    { id: 'p-1', label: 'Anna Berg', groups: [], colors: [], isCenter: false },
  ],
  edges: [{ source: 'user-1', target: 'p-1', type: 'Friend', color: '#888888' }],
};

function renderGraph() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UnifiedNetworkGraph apiEndpoint="/api/dashboard/graph" />
    </NextIntlClientProvider>,
  );
}

describe('UnifiedNetworkGraph', () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    created.sims.length = 0;
    created.charges.length = 0;
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
  });

  it('stops the layout simulation when it unmounts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => graph }));
    const { unmount } = renderGraph();
    await waitFor(() => expect(created.sims.length).toBeGreaterThan(0));
    const sim = created.sims[created.sims.length - 1] as Simulation<never, never>;
    expect(sim.stop).not.toHaveBeenCalled();

    unmount();

    expect(sim.stop).toHaveBeenCalled();
  });

  it('survives a failed request without an unhandled rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      renderGraph();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('lays out with the phone settings when the screen is narrow', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => graph }));
    renderGraph();
    await waitFor(() => expect(created.charges.length).toBeGreaterThan(0));
    expect(created.charges[created.charges.length - 1]).toBe(-250);
  });

  it('clears the hover when the pointer leaves the canvas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => graph }));
    const { container } = renderGraph();
    await waitFor(() => expect(created.sims.length).toBeGreaterThan(0));
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    if (!canvas) return;

    // Sweep the canvas until the pointer is over a node
    await waitFor(() => {
      for (let x = -400; x <= 400 && canvas.style.cursor !== 'pointer'; x += 8) {
        for (let y = -400; y <= 400 && canvas.style.cursor !== 'pointer'; y += 8) {
          canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }));
        }
      }
      expect(canvas.style.cursor).toBe('pointer');
    });

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mouseleave'));
    });
    expect(canvas.style.cursor).toBe('default');
  });

  it('moves focus into the full screen view and back to the button on Escape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => graph }));
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <UnifiedNetworkGraph apiEndpoint="/api/dashboard/graph" groups={[]} />
      </NextIntlClientProvider>,
    );
    const opener = await screen.findByRole('button', { name: 'Full screen' });
    opener.focus();
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Your network in full screen' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toBe(opener);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Full screen' })).toHaveFocus();
  });
});
