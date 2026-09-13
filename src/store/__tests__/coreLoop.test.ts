import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerStore } from '../useTimerStore';
import { useSettingsStore } from '../useSettingsStore';
import { distractionsRepo, sessionsRepo } from '@/db/repositories';
import { MINUTE } from '@/lib/utils';
import { bootStores, resetApp } from '@/test/helpers';

/**
 * The app's central mechanism, driven end to end through the real stores and a
 * real (in-memory) IndexedDB: start a session, park a thought mid-session,
 * finish, answer the review, deal with the parked note, and roll into a break.
 *
 * Four stores cooperate here and the ordering is subtle — auto-start has to wait
 * for both prompts, and the prompts are shown one after the other rather than
 * together. Each piece has a unit test somewhere; nothing checked that they
 * still add up to the loop a user actually goes through.
 *
 * This is not a browser test. It drives the store actions the UI calls, not the
 * UI itself, so it will not catch a button wired to the wrong action.
 */

/** Starts a focus session and winds its clock back so it has run its full length. */
async function runAFullSession() {
  await useTimerStore.getState().startSession('focus');
  useTimerStore.setState((s) => ({
    timer: { ...s.timer, startedAt: Date.now() - 26 * MINUTE },
  }));
  return useTimerStore.getState().sessionId!;
}

describe('the core loop', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('holds the break until the review and the parked note are both dealt with', async () => {
    const sessionId = await runAFullSession();

    // Mid-session, the user sets a thought aside to come back to.
    await useTimerStore.getState().logDistraction('d-phone', 'Call the bank back', true);

    await useTimerStore.getState().complete();

    // Both prompts are queued, and the break waits rather than ticking away
    // underneath them.
    const afterFinish = useTimerStore.getState();
    expect(afterFinish.pendingReview?.id).toBe(sessionId);
    expect(afterFinish.pendingParked).toHaveLength(1);
    expect(afterFinish.timer.type).toBe('short-break');
    expect(afterFinish.timer.status).toBe('idle');

    // The review is answered first.
    await useTimerStore.getState().submitReview(4, 'Drafted the intro');
    expect(useTimerStore.getState().pendingReview).toBeNull();
    // One prompt still open, so still no break.
    expect(useTimerStore.getState().timer.status).toBe('idle');

    // Then the parked note — dropped, in this case.
    const [parked] = useTimerStore.getState().pendingParked;
    await distractionsRepo.resolveParked([parked.id]);
    useTimerStore.getState().clearParked();

    // Only now does the break start.
    await vi.waitFor(() => expect(useTimerStore.getState().timer.status).toBe('running'));
    expect(useTimerStore.getState().timer.type).toBe('short-break');

    // And the history reflects everything that happened.
    const session = await sessionsRepo.get(sessionId);
    expect(session).toMatchObject({
      completed: true,
      productivityAfter: 4,
      accomplishment: 'Drafted the intro',
      distractionCount: 1,
      actualMs: 25 * MINUTE,
    });
    const [distraction] = await distractionsRepo.all();
    expect(distraction.parkResolvedAt).toBeTypeOf('number');
  });

  it('rolls straight into the break when there is nothing to ask', async () => {
    await useSettingsStore.getState().update({ askProductivityAfter: false });
    await runAFullSession();

    await useTimerStore.getState().complete();

    expect(useTimerStore.getState().pendingReview).toBeNull();
    expect(useTimerStore.getState().pendingParked).toHaveLength(0);
    await vi.waitFor(() => expect(useTimerStore.getState().timer.status).toBe('running'));
    expect(useTimerStore.getState().timer.type).toBe('short-break');
  });

  it('leaves the break for the user to start when auto-start is off', async () => {
    await useSettingsStore.getState().update({ autoStartBreaks: false, askProductivityAfter: false });
    await runAFullSession();

    await useTimerStore.getState().complete();

    // Give a stray auto-start every chance to happen before asserting it did not.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useTimerStore.getState().timer.type).toBe('short-break');
    expect(useTimerStore.getState().timer.status).toBe('idle');
  });

  it('earns a long break after the configured number of focus sessions', async () => {
    await useSettingsStore.getState().update({
      askProductivityAfter: false,
      autoStartBreaks: false,
      sessionsUntilLongBreak: 2,
    });

    await runAFullSession();
    await useTimerStore.getState().complete();
    expect(useTimerStore.getState().timer.type).toBe('short-break');

    // Through the break and into the second focus session.
    await useTimerStore.getState().startSession('short-break');
    await useTimerStore.getState().complete({ early: true });
    await runAFullSession();
    await useTimerStore.getState().complete();

    expect(useTimerStore.getState().timer.type).toBe('long-break');
  });
});
