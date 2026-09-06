import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentNetwork } from './AgentNetwork';

/**
 * The network's only job is to be TRUE. A graph that lights plausible-looking
 * nodes is worse than no graph: it turns "the system did X" into a claim the
 * user has no way to check.
 */

const nodeState = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll<SVGGElement>('.fx-net__node')]
    .find((g) => g.querySelector('text')?.textContent === label)
    ?.dataset.state;

const litCount = (container: HTMLElement) =>
  container.querySelectorAll('.fx-net__node[data-state="active"], .fx-net__node[data-state="done"]').length;

describe('AgentNetwork', () => {
  it('lights nothing at rest and says so', () => {
    const { container } = render(<AgentNetwork status="" running={false} />);
    expect(litCount(container)).toBe(0);
    expect(screen.getByText('Awaiting data')).toBeInTheDocument();
    expect(container.querySelector('.fx-net')?.getAttribute('data-idle')).toBe('true');
  });

  it('lights only the node the backend actually named', () => {
    const { container } = render(<AgentNetwork status="Researching" running />);
    expect(nodeState(container, 'Research')).toBe('active');
    // Everything else stays dark. Drawing the rest as "pending" would imply
    // queued work that nothing has scheduled.
    expect(litCount(container)).toBe(1);
    expect(nodeState(container, 'Plan')).toBe('idle');
    expect(nodeState(container, 'Verify')).toBe('idle');
  });

  it('keeps earlier stages of the same run marked done', () => {
    const { container, rerender } = render(<AgentNetwork status="Planning" running />);
    rerender(<AgentNetwork status="Researching" running />);
    rerender(<AgentNetwork status="Verifying" running />);

    expect(nodeState(container, 'Plan')).toBe('done');
    expect(nodeState(container, 'Research')).toBe('done');
    expect(nodeState(container, 'Verify')).toBe('active');
    // Never visited — and never invented.
    expect(nodeState(container, 'Documents')).toBe('idle');
  });

  it('clears the trace when a new run starts', () => {
    const { container, rerender } = render(<AgentNetwork status="Researching" running />);
    rerender(<AgentNetwork status="" running={false} />);
    rerender(<AgentNetwork status="Planning" running />);

    // A network still lit from the previous question would claim work is
    // happening now.
    expect(nodeState(container, 'Research')).toBe('idle');
    expect(nodeState(container, 'Plan')).toBe('active');
  });

  it('ignores a label it does not recognise rather than guessing a node', () => {
    const { container } = render(<AgentNetwork status="Consulting the oracle" running />);
    expect(litCount(container)).toBe(0);
    // The unknown label is still reported verbatim — the backend said it, so
    // the user sees it; only the GRAPH declines to interpret it.
    expect(screen.getByText('Consulting the oracle')).toBeInTheDocument();
  });

  it('shows a neutral word when a run has no label yet', () => {
    render(<AgentNetwork status="" running />);
    expect(screen.getByText('Working')).toBeInTheDocument();
  });

  it('only flows a link into the node that is currently active', () => {
    const { container, rerender } = render(<AgentNetwork status="Planning" running />);
    rerender(<AgentNetwork status="Researching" running />);

    const flowing = container.querySelectorAll('.fx-net__link[data-state="flow"]');
    expect(flowing).toHaveLength(1);
    expect(container.querySelectorAll('.fx-net__link[data-state="done"]')).toHaveLength(0);
  });

  it('exposes the status as text, not only as a picture', () => {
    const { container } = render(<AgentNetwork status="Verifying" running />);
    // The graph is decoration for the readout — hence aria-hidden on the SVG.
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Verifying');
  });
});
