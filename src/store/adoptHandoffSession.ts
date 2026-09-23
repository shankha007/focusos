import { sessionsRepo } from '@/db/repositories';
import { xpForSession } from '@/engine/achievements';
import { clearParkedSession, readParkedSession, sessionFromHandoff } from '@/features/landing/handoff';
import { uid } from '@/lib/utils';
import { useSettingsStore } from './useSettingsStore';

/**
 * Adopts a session finished on the landing page, if there is one waiting.
 *
 * Run once while the workspace boots, before the stats are read, so the session
 * is already in the database when the dashboard counts the day. It banks the XP
 * a session of that length earns in the app, because the work was the same
 * work — the only difference is which page the clock was on.
 *
 * Everything here is best-effort. Someone opening the app is entitled to have
 * it open; a session that cannot be adopted is a lost record, not a reason to
 * fail the boot.
 */
export async function adoptHandoffSession(): Promise<void> {
  const parked = readParkedSession();
  if (!parked) return;

  // Cleared first. A write that throws halfway would otherwise be retried on
  // every boot, and a session that cannot be stored once will not store on the
  // tenth attempt either — while a duplicate of a session that *did* land is
  // permanent, and silently inflates the history the app then reasons about.
  clearParkedSession();

  try {
    const session = sessionFromHandoff(parked, `ses_${uid()}`);
    await sessionsRepo.add(session);

    const settings = useSettingsStore.getState().settings;
    await useSettingsStore.getState().update({ xp: settings.xp + xpForSession(session) });
  } catch (error) {
    console.error('FocusOS could not adopt the session from the landing page', error);
  }
}
