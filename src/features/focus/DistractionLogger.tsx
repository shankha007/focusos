import { useState } from 'react';
import { toast } from 'sonner';
import { DynamicIcon } from '@/components/DynamicIcon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useTaskStore } from '@/store/useTaskStore';
import { useTimerStore } from '@/store/useTimerStore';
import { useStatsStore } from '@/store/useStatsStore';

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

  const submit = async (categoryId: string) => {
    await logDistraction(categoryId, note.trim() || undefined);
    await useStatsStore.getState().refresh();
    const label = categories.find((c) => c.id === categoryId)?.label ?? 'Distraction';
    toast(`Logged: ${label}`, { description: 'Noted. Get back to it.' });
    setNote('');
    setSelected(null);
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
          placeholder="Optional note…"
          className="mt-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && selected) void submit(selected);
          }}
        />

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
