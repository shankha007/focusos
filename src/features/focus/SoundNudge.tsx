import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Headphones, X } from 'lucide-react';
import { SOUNDS, ambient } from '@/lib/audio';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  NUDGE_DELAY_MS,
  NUDGE_VISIBLE_MS,
  markNudgeDismissed,
  markNudgeShown,
  nudgeAllowed,
  readNudge,
} from './nudgeRules';

/**
 * A quiet, one-line suggestion to add ambient sound, sitting beside the sound
 * button in Deep Focus.
 *
 * It waits until the session is already under way, speaks in the same muted
 * text as the shortcut legend, and leaves on its own. Accepting it plays the
 * sound last chosen (rain, for someone who never has) — one click, no panel.
 * See `nudgeRules.ts` for how rarely it is allowed to appear.
 */
export function SoundNudge({ active }: { active: boolean }) {
  const soundEnabled = useSettingsStore((s) => s.settings.soundEnabled);
  const activeSound = useSettingsStore((s) => s.settings.activeSound);
  const volume = useSettingsStore((s) => s.settings.soundVolume);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const update = useSettingsStore((s) => s.update);

  const [visible, setVisible] = useState(false);
  const eligible = active && !soundEnabled;

  // Appear a few seconds in. The cleanup takes it away the moment it stops
  // applying — sound switched on, session paused, the sound panel opened — and
  // since today's showing is already recorded, it does not come back.
  useEffect(() => {
    if (!eligible || !nudgeAllowed(readNudge())) return;
    const show = window.setTimeout(() => {
      markNudgeShown();
      setVisible(true);
    }, NUDGE_DELAY_MS);
    return () => {
      window.clearTimeout(show);
      setVisible(false);
    };
  }, [eligible]);

  useEffect(() => {
    if (!visible) return;
    const hide = window.setTimeout(() => setVisible(false), NUDGE_VISIBLE_MS);
    return () => window.clearTimeout(hide);
  }, [visible]);

  const sound = SOUNDS.find((s) => s.id === activeSound) ?? SOUNDS[0];

  const accept = async () => {
    setVisible(false);
    await update({ activeSound: sound.id, soundEnabled: true });
    // This click is the user gesture browsers require before audio can start.
    void ambient.play(sound.id, volume);
  };

  const dismiss = () => {
    setVisible(false);
    markNudgeDismissed();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="mr-1 flex items-center text-[12px] text-subtle"
        >
          <button
            onClick={() => void accept()}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:text-fg"
          >
            <Headphones className="h-3.5 w-3.5" />
            Focus with {sound.label.toLowerCase()}?
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss sound suggestion"
            className="rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
