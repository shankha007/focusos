import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatedList } from '../AnimatedList';
import { Presence } from '../Presence';

/**
 * jsdom has no Web Animations API. This stands in for element.animate(), and
 * lets a test finish or inspect each animation it started.
 */
interface FakeAnimation {
  el: HTMLElement;
  keyframes: Keyframe[];
  finish: () => void;
  cancel: ReturnType<typeof vi.fn>;
}
let started: FakeAnimation[] = [];

beforeEach(() => {
  started = [];
  HTMLElement.prototype.animate = function (this: HTMLElement, keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
    let resolve!: () => void;
    let reject!: (reason: unknown) => void;
    const finished = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // Never let a cancellation surface as an unhandled rejection in a test.
    finished.catch(() => {});
    const cancel = vi.fn(() => reject(new DOMException('cancelled', 'AbortError')));
    started.push({ el: this, keyframes: keyframes as Keyframe[], finish: resolve, cancel });
    return { finished, cancel } as unknown as Animation;
  };
  // What is still running on an element: started here, not yet cancelled.
  HTMLElement.prototype.getAnimations = function (this: HTMLElement) {
    return started
      .filter((a) => a.el === this && a.cancel.mock.calls.length === 0)
      .map((a) => ({ cancel: a.cancel }) as unknown as Animation);
  };
});

afterEach(() => {
  // @ts-expect-error — removing the stand-ins, so jsdom is back to having none.
  delete HTMLElement.prototype.animate;
  // @ts-expect-error — as above.
  delete HTMLElement.prototype.getAnimations;
});

const Rows = ({ items }: { items: string[] }) => (
  <AnimatedList items={items} getKey={(item) => item}>
    {(item) => <li>{item}</li>}
  </AnimatedList>
);

const rowFor = (text: string) => screen.getByText(text).parentElement as HTMLElement;

describe('AnimatedList', () => {
  it('animates nothing on the first render', () => {
    render(<Rows items={['a', 'b']} />);
    expect(started).toHaveLength(0);
  });

  it('grows a new row in from nothing', () => {
    const { rerender } = render(<Rows items={['a']} />);
    rerender(<Rows items={['a', 'b']} />);

    expect(started).toHaveLength(1);
    expect(started[0].el).toBe(rowFor('b'));
    expect(started[0].keyframes[0]).toMatchObject({ height: '0px', opacity: 0 });
  });

  it('keeps a removed row on screen until its exit finishes, then drops it', async () => {
    const { rerender } = render(<Rows items={['a', 'b']} />);
    rerender(<Rows items={['a']} />);

    expect(screen.getByText('b')).toBeInTheDocument();
    const exit = started.find((a) => a.el === rowFor('b'))!;
    expect(exit.keyframes[1]).toMatchObject({ height: '0px', opacity: 0 });

    await act(() => {
      exit.finish();
      return Promise.resolve();
    });
    expect(screen.queryByText('b')).toBeNull();
  });

  it('stops a row growing in when it is removed part-way, so only the exit runs', () => {
    const { rerender } = render(<Rows items={['a']} />);
    rerender(<Rows items={['a', 'b']} />);
    const entrance = started.find((a) => a.el === rowFor('b'))!;

    rerender(<Rows items={['a']} />);
    expect(entrance.cancel).toHaveBeenCalled();
    expect(started.filter((a) => a.el === rowFor('b'))).toHaveLength(2);
  });

  it('keeps a removed row where it was in the list while it leaves', () => {
    const { rerender } = render(<Rows items={['a', 'b', 'c']} />);
    rerender(<Rows items={['a', 'c']} />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['a', 'b', 'c']);
  });

  it('stops the exit when the row comes back before it has gone', async () => {
    const { rerender } = render(<Rows items={['a', 'b']} />);
    rerender(<Rows items={['a']} />);
    const exit = started.find((a) => a.el === rowFor('b'))!;

    rerender(<Rows items={['a', 'b']} />);
    expect(exit.cancel).toHaveBeenCalled();

    // Settling the cancelled exit must not take the row with it.
    await act(() => Promise.resolve());
    expect(screen.getByText('b')).toBeInTheDocument();
  });
});

describe('Presence', () => {
  it('renders its children while shown, keeps them through the exit, then removes them', async () => {
    const { rerender } = render(
      <Presence show enter="fade-in" exit="fade-out">
        <p>panel</p>
      </Presence>,
    );
    const wrapper = screen.getByText('panel').parentElement!;
    expect(wrapper).toHaveClass('fade-in');
    expect(wrapper).toHaveAttribute('data-presence');

    rerender(
      <Presence show={false} enter="fade-in" exit="fade-out">
        <p>panel</p>
      </Presence>,
    );
    // Still there, now running the exit…
    expect(screen.getByText('panel').parentElement).toHaveClass('fade-out');

    // …and gone once it is over. jsdom runs no CSS animations, so that is at once.
    await act(() => Promise.resolve());
    expect(screen.queryByText('panel')).toBeNull();
  });

  it('comes back with an entrance when shown again', () => {
    const view = (show: boolean) => (
      <Presence show={show} enter="fade-in" exit="fade-out">
        <p>panel</p>
      </Presence>
    );
    const { rerender } = render(view(false));
    expect(screen.queryByText('panel')).toBeNull();

    rerender(view(true));
    expect(screen.getByText('panel').parentElement).toHaveClass('fade-in');
  });
});
