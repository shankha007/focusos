import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStatsStore } from '../useStatsStore';
import { useTimerStore } from '../useTimerStore';
import { useSettingsStore } from '../useSettingsStore';
import { distractionsRepo, sessionsRepo } from '@/db/repositories';
import { MINUTE } from '@/lib/utils';
import { bootStores, makeSession, resetApp } from '@/test/helpers';

/**
 * The in-memory history is now kept current by applying each change as it is
 * made, instead of re-reading both tables after every write. That is only safe
 * if the result is indistinguishable from a re-read — same rows, same values,
 * same order — so that is what every test here ends by checking.
 */
async function expectInStepWithDatabase() {
  const { sessions, distractions } = useStatsStore.getState();
  const [storedSessions, storedDistractions] = await Promise.all([
    sessionsRepo.all(),
    distractionsRepo.all(),
  ]);
  expect(sessions).toEqual(storedSessions);
  expect(distractions).toEqual(storedDistractions);
}

describe('useStatsStore — kept in step without re-reading history', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('never re-reads history across a whole session', async () => {
    const readSessions = vi.spyOn(sessionsRepo, 'all');
    const readDistractions = vi.spyOn(distractionsRepo, 'all');

    await useTimerStore.getState().startSession('focus');
    await useTimerStore.getState().logDistraction('d-phone');
    await useTimerStore.getState().logDistraction('d-thoughts', 'Book the dentist', true);
    useTimerStore.setState((s) => ({ timer: { ...s.timer, startedAt: Date.now() - 26 * MINUTE } }));
    await useTimerStore.getState().complete();
    await useTimerStore.getState().submitReview(5, 'Finished the draft');

    // The finding this fixes: each of those steps used to read and deserialise
    // every session and distraction ever logged, to change one row.
    expect(readSessions).not.toHaveBeenCalled();
    expect(readDistractions).not.toHaveBeenCalled();

    readSessions.mockRestore();
    readDistractions.mockRestore();
    await expectInStepWithDatabase();
    expect(useStatsStore.getState().sessions[0]).toMatchObject({
      productivityAfter: 5,
      accomplishment: 'Finished the draft',
    });
  });

  it('drops the distractions of a false start, in memory as well as on disk', async () => {
    await useTimerStore.getState().startSession('focus');
    await useTimerStore.getState().logDistraction('d-phone');
    expect(useStatsStore.getState().distractions).toHaveLength(1);

    // Under a minute and skipped: not a session worth logging.
    await useTimerStore.getState().complete({ early: true });

    expect(useStatsStore.getState().distractions).toHaveLength(0);
    await expectInStepWithDatabase();
  });

  it('drops the distractions of a reset session, which nothing re-reads after any more', async () => {
    await useSettingsStore.getState().update({ askMoodBefore: false });
    await useTimerStore.getState().startSession('focus');
    await useTimerStore.getState().logDistraction('d-email');

    useTimerStore.getState().reset();

    // The cleanup runs in the background; the idle-status reload used to pick
    // it up, and without one the in-memory copy has to be updated directly.
    await vi.waitFor(() => expect(useStatsStore.getState().distractions).toHaveLength(0));
    await expectInStepWithDatabase();
  });

  it('keeps an edited older session in its place', async () => {
    const now = Date.now();
    const older = makeSession({ id: 'older', startedAt: now - 3 * 3_600_000 });
    const newer = makeSession({ id: 'newer', startedAt: now - 3_600_000 });
    await sessionsRepo.add(older);
    await sessionsRepo.add(newer);
    await useStatsStore.getState().refresh();

    const edited = { ...older, productivityAfter: 2 as const };
    await sessionsRepo.update('older', { productivityAfter: 2 });
    useStatsStore.getState().upsertSession(edited);

    // Replacing by id must not move the row to the end of history.
    expect(useStatsStore.getState().sessions.map((s) => s.id)).toEqual(['older', 'newer']);
    await expectInStepWithDatabase();
  });

  it('breaks ties on start time the way IndexedDB does, by id', async () => {
    const at = Date.now() - 3_600_000;
    await sessionsRepo.add(makeSession({ id: 'b', startedAt: at }));
    await useStatsStore.getState().refresh();

    const tied = makeSession({ id: 'a', startedAt: at });
    await sessionsRepo.add(tied);
    useStatsStore.getState().upsertSession(tied);

    await expectInStepWithDatabase();
  });

  it('does not replace the array when there was nothing to remove', () => {
    const before = useStatsStore.getState().distractions;
    useStatsStore.getState().removeDistractionsForSession('ses_never_existed');
    // Subscribers compare by identity; a no-op must not look like a change.
    expect(useStatsStore.getState().distractions).toBe(before);
  });
});
