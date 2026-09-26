import { useState } from 'react';
import type { Rating } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RatingPicker } from './RatingPicker';

/**
 * Pre-session check-in. Two taps, and it's what makes the mood-vs-productivity
 * analysis possible later — so it's worth the friction.
 *
 * Skipping reports nothing rather than a middling 3/3. A default would be
 * indistinguishable from a real answer in `moodCorrelation`, so every skipped
 * session would quietly drag the correlation toward the mean — the app would be
 * analysing data the user never gave it.
 */
export function MoodCheckDialog({
  open,
  onOpenChange,
  onConfirm,
  taskTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (mood: Rating | null, energy: Rating | null) => void;
  taskTitle?: string | null;
}) {
  const [mood, setMood] = useState<Rating | null>(null);
  const [energy, setEnergy] = useState<Rating | null>(null);

  // Half an answer is not an answer: the correlation needs both scales, so a
  // partial check-in is recorded the same way as no check-in at all.
  const answered = mood !== null && energy !== null;

  /** Starts the session, recording the check-in only when both scales were answered. */
  const start = (record: boolean) => {
    onConfirm(record ? mood : null, record ? energy : null);
    setMood(null);
    setEnergy(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Before you start</DialogTitle>
        <DialogDescription>
          {taskTitle ? `Focusing on ${taskTitle}.` : 'A quick check-in.'} This is what lets FocusOS
          tell you when you actually work best.
        </DialogDescription>

        <div className="mt-5 space-y-4">
          <RatingPicker scale="mood" label="How are you feeling?" value={mood} onChange={setMood} />
          <RatingPicker
            scale="energy"
            label="Energy level?"
            value={energy}
            onChange={setEnergy}
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {!answered && (
            <p className="mr-auto text-[12px] text-subtle">
              Answer both to record the check-in, or skip it.
            </p>
          )}
          <Button variant="ghost" onClick={() => start(false)}>
            Skip
          </Button>
          <Button onClick={() => start(true)} disabled={!answered}>
            Start session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
