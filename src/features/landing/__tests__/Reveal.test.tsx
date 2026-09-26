import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reveal } from '../Reveal';

/**
 * jsdom has no layout, so it has no IntersectionObserver either. This stands in
 * for one and lets a test decide when the element "scrolls into view".
 */
let observers: { callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn();
      constructor(public callback: IntersectionObserverCallback) {
        observers.push(this);
      }
      observe() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const scrollIntoView = (isIntersecting: boolean) =>
  act(() => {
    for (const o of observers) {
      o.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    }
  });

describe('Reveal', () => {
  it('stays hidden until it scrolls into view, then reveals once and stops watching', () => {
    render(<Reveal>Section</Reveal>);
    const el = screen.getByText('Section');
    expect(el.dataset.reveal).toBe('');

    scrollIntoView(false);
    expect(el.dataset.reveal).toBe('');

    scrollIntoView(true);
    expect(el.dataset.reveal).toBe('shown');
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it('staggers with an animation delay, leaving any other style alone', () => {
    render(
      <Reveal delay={0.12} style={{ color: 'red' }}>
        Card
      </Reveal>,
    );
    const el = screen.getByText('Card');
    expect(el.style.animationDelay).toBe('0.12s');
    expect(el.style.color).toBe('red');
  });

  it('shows its content at once where there is no IntersectionObserver to wait on', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Reveal>Old browser</Reveal>);
    expect(screen.getByText('Old browser').dataset.reveal).toBe('shown');
  });
});
