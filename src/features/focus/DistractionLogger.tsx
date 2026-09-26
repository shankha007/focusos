import { useState } from 'react';
import { toast } from 'sonner';
import { Bookmark } from 'lucide-react';
import { DynamicIcon } from '@/components/DynamicIcon';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/store/useTaskStore';
import { useTimerStore } from '@/store/useTimerStore';

/** Two-tap logging of an interruption: pick what pulled you away, optionally write the thought down, and optionally park it to be turned into a task when the session ends. */
export function DistractionLogger({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const categories = useTaskStore((s) => s.distractionCategories);
  const logDistraction = useTimerStore((s) => s.logDistraction);
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [park, setPark] = useState(false);

  const trimmed = note.trim();
  // Nothing to park without a note — there'd be no task to make from it.
  const canPark = trimmed.length > 0;

  /** Records the distraction against the running session and closes the dialog. */
  const submit = async (categoryId: string) => {
    const parking = park && canPark;
    await logDistraction(categoryId, trimmed || undefined, parking);
    const label = categories.find((c) => c.id === categoryId)?.label ?? 'Distraction';
    toast(`Logged: ${label}`, {
      description: parking ? "Parked. It'll come back when the session ends." : 'Noted. Get back to it.',
    });
    setNote('');
    setSelected(null);
    setPark(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>What pulled you away?</DialogTitle>
        <DialogDescription>
          Logging takes two seconds and turns a bad habit into data you can act on.
        </DialogDescription>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelected(cat.id === selected ? null : cat.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                selected === cat.id
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-subtle/40 hover:bg-elevated'
              }`}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
              >
                <DynamicIcon name={cat.icon} className="h-4 w-4" />
              </span>
              <span className="text-[12px] font-medium">{cat.label}</span>
            </button>
          ))}
        </div>

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note — what was the thought?"
          className="mt-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && selected) void submit(selected);
          }}
        />

        <button
          type="button"
          disabled={!canPark}
          aria-pressed={park && canPark}
          onClick={() => setPark((v) => !v)}
          className={cn(
            'mt-2 flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-all',
            park && canPark
              ? 'border-accent bg-accent/10'
              : 'border-border hover:border-subtle/40 hover:bg-elevated',
            !canPark && 'cursor-not-allowed opacity-50 hover:border-border hover:bg-transparent',
          )}
        >
          <Bookmark
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              park && canPark ? 'fill-accent text-accent' : 'text-subtle',
            )}
          />
          <span>
            <span className="block text-[13px] font-medium">Park it for later</span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
              {canPark
                ? "You'll be asked whether to keep it as a task when this session ends."
                : 'Write the thought down first, then you can park it.'}
            </span>
          </span>
        </button>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!selected} onClick={() => selected && void submit(selected)}>
            Log it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
