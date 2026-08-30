import { useState } from 'react';
import type { Rating } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { RatingPicker } from './RatingPicker';

/**
 * Pre-session check-in. Two taps, and it's what makes the mood-vs-productivity
 * analysis possible later — so it's worth the friction.
 */
export function MoodCheckDialog({
  open,
  onOpenChange,
  onConfirm,
  taskTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (mood: Rating, energy: Rating) => void;
  taskTitle?: string | null;
}) {
  const [mood, setMood] = useState<Rating | null>(null);
  const [energy, setEnergy] = useState<Rating | null>(null);

  /** Starts the session with whatever was picked, defaulting both scales to the middle when the user skips. */
  const start = () => {
    onConfirm(mood ?? 3, energy ?? 3);
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

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={start}>
            Skip
          </Button>
          <Button onClick={start}>Start session</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
