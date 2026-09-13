import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityFeed } from '../ActivityFeed';
import { useStatsStore } from '@/store/useStatsStore';
import { sessionsRepo } from '@/db/repositories';
import { MINUTE } from '@/lib/utils';
import { bootStores, makeSession, resetApp } from '@/test/helpers';

describe('ActivityFeed — correcting history', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('deletes a session after confirming, and says what will go with it', async () => {
    const user = userEvent.setup();
    const session = makeSession({ id: 'ses_lunch', startedAt: Date.now() - 90 * MINUTE, taskTitle: 'Left running over lunch' });
    await sessionsRepo.add(session);
    useStatsStore.getState().upsertSession(session);
    render(<ActivityFeed />);

    expect(screen.getByText('Left running over lunch')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete this session' }));

    // A finished session earned XP; the confirmation says it will be taken back.
    expect(await screen.findByRole('heading', { name: 'Delete this session?' })).toBeInTheDocument();
    expect(screen.getByText(/XP and task credit it earned will be taken back/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete session' }));

    await vi.waitFor(() => expect(screen.queryByText('Left running over lunch')).not.toBeInTheDocument());
    expect(await sessionsRepo.get('ses_lunch')).toBeUndefined();
  });

  it('keeps the session when the user backs out', async () => {
    const user = userEvent.setup();
    const session = makeSession({ id: 'ses_keep', startedAt: Date.now() - 60 * MINUTE, taskTitle: 'Worth keeping' });
    await sessionsRepo.add(session);
    useStatsStore.getState().upsertSession(session);
    render(<ActivityFeed />);

    await user.click(screen.getByRole('button', { name: 'Delete this session' }));
    await user.click(await screen.findByRole('button', { name: 'Keep it' }));

    expect(screen.getByText('Worth keeping')).toBeInTheDocument();
    expect(await sessionsRepo.get('ses_keep')).toBeDefined();
  });
});
