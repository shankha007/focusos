import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionReviewDialog } from '../SessionReviewDialog';
import { useTimerStore } from '@/store/useTimerStore';
import { useStatsStore } from '@/store/useStatsStore';
import { sessionsRepo } from '@/db/repositories';
import { MINUTE } from '@/lib/utils';
import { bootStores, makeSession, resetApp } from '@/test/helpers';

/** A finished session waiting for its review, as `complete` leaves it. */
async function awaitingReview(id: string) {
  const session = makeSession({ id, startedAt: Date.now() - 30 * MINUTE });
  await sessionsRepo.add(session);
  useStatsStore.getState().upsertSession(session);
  useTimerStore.setState({ pendingReview: session });
  return session;
}

describe('SessionReviewDialog', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('will not save when nothing has been given', async () => {
    await awaitingReview('ses_empty');
    render(<SessionReviewDialog />);

    // With no rating and no note, saving is the same as skipping.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves a note on its own, without inventing a rating to go with it', async () => {
    const user = userEvent.setup();
    await awaitingReview('ses_note');
    render(<SessionReviewDialog />);

    await user.type(screen.getByLabelText('What did you get done?'), 'Outlined the talk');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(async () =>
      expect((await sessionsRepo.get('ses_note'))?.accomplishment).toBe('Outlined the talk'),
    );
    // The bug this replaces: productivity ?? 3 stored "Okay" for a question
    // nobody answered, and every chart read it back as a real rating.
    expect((await sessionsRepo.get('ses_note'))?.productivityAfter).toBeUndefined();
    expect(useStatsStore.getState().sessions[0].productivityAfter).toBeUndefined();
  });

  it('saves the rating that was actually picked', async () => {
    const user = userEvent.setup();
    await awaitingReview('ses_rated');
    render(<SessionReviewDialog />);

    await user.click(screen.getByRole('button', { name: /Focused/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(async () => expect((await sessionsRepo.get('ses_rated'))?.productivityAfter).toBe(4));
  });
});
