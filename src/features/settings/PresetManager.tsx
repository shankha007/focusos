import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { usePresetStore, describePreset, matchesSettings } from '@/store/usePresetStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { cn, pluralize } from '@/lib/utils';

/** Lists the saved timer cadences, switches between them, and offers to save the current one. A preset reads as active only while the live settings still match it. */
export function PresetManager() {
  const presets = usePresetStore((s) => s.presets);
  const apply = usePresetStore((s) => s.apply);
  const remove = usePresetStore((s) => s.remove);
  const settings = useSettingsStore((s) => s.settings);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="space-y-2">
        {presets.map((preset) => {
          // "Active" means the settings still match, not just that this preset
          // was the last one clicked — a manual tweak in the sliders above
          // should visibly detach the label.
          const active = matchesSettings(preset, settings);
          return (
            <div
              key={preset.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 transition-all',
                active ? 'border-accent bg-accent/10' : 'border-border',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  void apply(preset.id).then((p) => {
                    if (p) toast.success(`Switched to ${p.name}.`, { description: describePreset(p) });
                  });
                }}
                className="min-w-0 flex-1 text-left"
                aria-pressed={active}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium">{preset.name}</span>
                  {preset.builtIn && <Badge tone="muted">Built-in</Badge>}
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-muted">
                  {describePreset(preset)}
                </span>
              </button>

              {!preset.builtIn && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${preset.name}`}
                  onClick={() => {
                    void remove(preset.id).then(() => toast.success(`Deleted ${preset.name}.`));
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setCreating(true)}>
        <Plus className="h-3.5 w-3.5" />
        Save current as preset
      </Button>

      <CreatePresetDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

/** Names the current timer settings and saves them as a preset, then puts it into force. Duplicate names are rejected. */
function CreatePresetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const settings = useSettingsStore((s) => s.settings);
  const create = usePresetStore((s) => s.create);
  const presets = usePresetStore((s) => s.presets);
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const trimmed = name.trim();
  const duplicate = presets.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());

  /** Creates the preset from the current settings and applies it. */
  const save = async () => {
    if (!trimmed || duplicate) return;
    const preset = await create({
      name: trimmed,
      focusMs: settings.focusMs,
      shortBreakMs: settings.shortBreakMs,
      longBreakMs: settings.longBreakMs,
      sessionsUntilLongBreak: settings.sessionsUntilLongBreak,
    });
    // Saving from the current settings means it is, by definition, in force.
    await usePresetStore.getState().apply(preset.id);
    toast.success(`Saved ${preset.name}.`, { description: describePreset(preset) });
    onOpenChange(false);
  };

  const summary = describePreset(settings);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Save this cadence as a preset</DialogTitle>
        <DialogDescription>
          Captures the four timer settings above so you can switch back to them in one step —
          from here, or from the command palette.
        </DialogDescription>

        <div className="mt-5">
          <label htmlFor="preset-name" className="mb-1.5 block text-[13px] font-medium">
            Name
          </label>
          <Input
            id="preset-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Deep work, Admin, Reading…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
          />
          {duplicate && (
            <p className="mt-1.5 text-[12px] text-danger">You already have a preset by that name.</p>
          )}
          <p className="mt-2 text-[12px] text-muted">
            Saving <span className="tabular font-medium text-fg">{summary}</span>
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!trimmed || duplicate} onClick={() => void save()}>
            Save preset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Attaches a preset to each category. A task in "Deep Work" then starts at
 * 90/20 without the user thinking about it — the payoff that makes presets
 * worth having rather than another thing to remember to switch.
 */
export function CategoryPresetMap() {
  const categories = useTaskStore((s) => s.categories);
  const setCategoryPreset = useTaskStore((s) => s.setCategoryPreset);
  const presets = usePresetStore((s) => s.presets);

  if (categories.length === 0) {
    return <p className="text-[12px] text-muted">No categories yet.</p>;
  }

  const attached = categories.filter((c) => c.presetId).length;

  return (
    <>
      <div className="space-y-2">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="truncate text-[13px]">{category.name}</span>
            </span>

            <Select
              value={category.presetId ?? 'none'}
              onValueChange={(value) =>
                void setCategoryPreset(category.id, value === 'none' ? undefined : value)
              }
            >
              <SelectTrigger className="w-[180px]" aria-label={`Preset for ${category.name}`}>
                <SelectValue placeholder="No preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No preset</SelectItem>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        {attached === 0
          ? 'Nothing attached yet — pick a preset and any task in that category will start with it.'
          : `${attached} ${pluralize(attached, 'category', 'categories')} will switch the timer automatically when you focus on a task in ${attached === 1 ? 'it' : 'them'}.`}
      </p>
    </>
  );
}
