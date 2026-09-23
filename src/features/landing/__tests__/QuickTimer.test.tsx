import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickTimer } from '../QuickTimer';
import { readParkedSession } from '../handoff';

/**
 * The landing timer is the first thing a visitor from a search result touches,
 * and it is the only timer in the app that runs without the database, the
 * stores or the settings behind it. These cover the paths that would embarrass
 * it: a session that finishes, one that is stopped early, and a tab that was
 * asleep when the clock ran out.
 */

const renderTimer = () =>
  render(
    <MemoryRouter>
      <QuickTimer />
    </MemoryRouter>,
  );

/**
 * Moves the wall clock forward and lets exactly one repaint tick run.
 *
 * Stepping the fake timers through the whole interval instead would fire the
 * 250ms repaint twelve thousand times for a fifty-minute session, re-rendering
 * on each — minutes of test for something the component decides from two
 * timestamps. Jumping is also the more honest simulation: a throttled or
 * suspended tab is precisely a clock that moved while no tick ran.
 */
const TICK_WINDOW = 300;

async function jump(ms: number) {
  // The 300ms spent letting the interval fire is part of the jump, not extra:
  // without this the clock gains 300ms per call, and three jumps is enough to
  // move a displayed minute.
  vi.setSystemTime(Date.now() + ms - TICK_WINDOW);
  await vi.advanceTimersByTimeAsync(TICK_WINDOW);
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('QuickTimer', () => {
  it('counts down from the preset once started', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTimer();

    expect(screen.getByText('25:00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /start focusing/i }));

    await jump(60_000);
    expect(screen.getByText('24:00')).toBeInTheDocument();
  });

  it('starts the length the chosen preset advertises', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTimer();

    await user.click(screen.getByRole('button', { name: '50 / 10' }));
    expect(screen.getByText('50:00')).toBeInTheDocument();
  });

  it('parks a finished session for the app to adopt', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTimer();

    await user.click(screen.getByRole('button', { name: '50 / 10' }));
    await user.click(screen.getByRole('button', { name: /start focusing/i }));
    await jump(50 * 60_000 + 1000);

    const parked = readParkedSession();
    expect(parked).not.toBeNull();
    expect(parked?.plannedMs).toBe(50 * 60_000);
    expect(parked?.actualMs).toBe(50 * 60_000);
    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
  });

  it('parks nothing when the session is reset before it ends', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTimer();

    await user.click(screen.getByRole('button', { name: /start focusing/i }));
    await jump(5 * 60_000);
    await user.click(screen.getByRole('button', { name: /reset/i }));

    // Unfinished work is not history. The app treats a false start the same way.
    expect(readParkedSession()).toBeNull();
    expect(screen.queryByText(/session complete/i)).not.toBeInTheDocument();
  });

  it('excludes paused time from the clock', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTimer();

    await user.click(screen.getByRole('button', { name: /start focusing/i }));
    await jump(60_000);
    await user.click(screen.getByRole('button', { name: /pause/i }));
    await jump(5 * 60_000);

    // Five minutes of pause must not spend the session.
    expect(screen.getByText('24:00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /resume/i }));
    await jump(60_000);
    expect(screen.getByText('23:00')).toBeInTheDocument();
  });

  it('finishes a session whose end passed while the tab was hidden', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderTimer();

    await user.click(screen.getByRole('button', { name: /start focusing/i }));

    // A background tab has its interval throttled to about once a minute, so
    // the end is noticed late. The engine reads wall-clock time, so late is
    // still correct — the session must not be credited with the overrun.
    await jump(30 * 60_000);

    expect(readParkedSession()?.actualMs).toBe(25 * 60_000);
  });

  it('puts the countdown in the tab title and restores it afterwards', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    document.title = 'Free Offline Pomodoro Timer with Analytics · FocusOS';
    const { unmount } = renderTimer();

    await user.click(screen.getByRole('button', { name: /start focusing/i }));
    await jump(60_000);
    expect(document.title).toMatch(/^24:00 · Focus — FocusOS$/);

    unmount();
    expect(document.title).toBe('Free Offline Pomodoro Timer with Analytics · FocusOS');
  });
});
