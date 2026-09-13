import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Rating } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Textarea,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { RatingPicker } from './RatingPicker';
import { useTimerStore } from '@/store/useTimerStore';
import { formatDuration } from '@/lib/utils';

/** Post-session debrief. Kept to two fields — anything longer gets skipped. */
export function SessionReviewDialog() {
  const pending = useTimerStore((s) => s.pendingReview);
  const submitReview = useTimerStore((s) => s.submitReview);
  const dismissReview = useTimerStore((s) => s.dismissReview);

  const [productivity, setProductivity] = useState<Rating | null>(null);
  const [accomplishment, setAccomplishment] = useState('');

  useEffect(() => {
    if (pending) {
      setProductivity(null);
      setAccomplishment('');
    }
  }, [pending]);

  if (!pending) return null;

  /**
   * Files what was actually given. A note with no rating is saved as a note.
   *
   * An unanswered rating used to be stored as 3, invented to fill the gap, and
   * every chart then read it back as the user saying the session felt "Okay" —
   * the same fabrication the pre-session check-in had, on the other side of the
   * session.
   */
  const save = async () => {
    await submitReview(productivity, accomplishment);
  };

  // With neither a rating nor a note there is nothing to save; that is a skip.
  const nothingGiven = productivity === null && !accomplishment.trim();

  return (
    <Dialog open onOpenChange={(open) => !open && dismissReview()}>
      <DialogContent className="max-w-md">
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/12 text-accent">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <DialogTitle>Session complete</DialogTitle>
        </div>
        <DialogDescription>
          {formatDuration(pending.actualMs)} of focus
          {pending.taskTitle ? ` on ${pending.taskTitle}` : ''}
          {pending.distractionCount > 0
            ? ` · ${pending.distractionCount} distraction${pending.distractionCount === 1 ? '' : 's'}`
            : ' · no distractions'}
          .
        </DialogDescription>

        <div className="mt-5 space-y-4">
          <RatingPicker
            scale="productivity"
            label="How productive did that feel?"
            value={productivity}
            onChange={setProductivity}
          />

          <div>
            <label
              htmlFor="accomplishment"
              className="mb-2 block text-[13px] font-medium text-fg"
            >
              What did you get done?
            </label>
            <Textarea
              id="accomplishment"
              value={accomplishment}
              onChange={(e) => setAccomplishment(e.target.value)}
              placeholder="One line is plenty — it feeds your daily reflection."
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={dismissReview}>
            Skip
          </Button>
          <Button onClick={() => void save()} disabled={nothingGiven}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
