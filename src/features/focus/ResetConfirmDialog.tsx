import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTimerStore } from '@/store/useTimerStore';
import { elapsedMs, labelForType } from '@/engine/timerEngine';
import { formatClock } from '@/lib/utils';

/**
 * Asks before a reset throws away a session with real work in it.
 *
 * Rendered once, alongside the app chrome, rather than inside Deep Focus. Reset
 * is reachable from there and from the command palette, and when the guard
 * lived privately in Deep Focus the palette discarded forty minutes of focus on
 * a single keystroke.
 */
export function ResetConfirmDialog() {
  const open = useTimerStore((s) => s.pendingReset);
  const timer = useTimerStore((s) => s.timer);
  const confirmReset = useTimerStore((s) => s.confirmReset);
  const cancelReset = useTimerStore((s) => s.cancelReset);

  const elapsed = elapsedMs(timer);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && cancelReset()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Discard this session?</DialogTitle>
        <DialogDescription>
          {formatClock(elapsed)} of {labelForType(timer.type).toLowerCase()} will be thrown away
          without being logged. Skip instead if you want it counted.
        </DialogDescription>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={cancelReset}>
            Keep going
          </Button>
          <Button variant="danger" onClick={confirmReset}>
            Discard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
