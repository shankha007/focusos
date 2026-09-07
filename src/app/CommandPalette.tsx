import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CheckSquare,
  LayoutDashboard,
  Maximize2,
  Moon,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  SkipForward,
  Sliders,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/primitives';
import { useTimerStore } from '@/store/useTimerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { usePresetStore, describePreset, matchesSettings } from '@/store/usePresetStore';
import { ambient } from '@/lib/audio';
import { THEME_OPTIONS } from '@/features/settings/themes';
import { toast } from 'sonner';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFocus: () => void;
}

/** The ⌘K palette. Beyond navigation it can drive the timer, switch theme or preset, and start focusing on a task — the sub-pages are reached by selecting an item that ends in "…", and Backspace on an empty search goes back. */
export function CommandPalette({ open, onOpenChange, onOpenFocus }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<'root' | 'themes' | 'tasks' | 'presets'>('root');

  const timer = useTimerStore((s) => s.timer);
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const presets = usePresetStore((s) => s.presets);
  const applyPreset = usePresetStore((s) => s.apply);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setPage('root');
    }
  }, [open]);

  /** Runs a command and closes the palette behind it. */
  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  const searching = search.trim() !== '';
  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived');
  const activePreset = presets.find((p) => matchesSettings(p, settings)) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="top-[18%] max-w-xl translate-y-0 p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          loop
          filter={rank}
          className="overflow-hidden"
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && search === '' && page !== 'root') {
              e.preventDefault();
              setPage('root');
            }
          }}
        >
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder={
                page === 'themes'
                  ? 'Choose a theme…'
                  : page === 'tasks'
                    ? 'Pick a task to focus on…'
                    : page === 'presets'
                      ? 'Switch to a timer preset…'
                      : 'Type a command or search…'
              }
              className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
            />
          </div>

          <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-[13px] text-subtle">
              No matching commands.
            </Command.Empty>

            {page === 'root' && (
              <Results searching={searching}>
                <Group heading="Timer" searching={searching}>
                  {timer.status === 'running' ? (
                    <Item
                      icon={Pause}
                      label="Pause session"
                      shortcut="Space"
                      onSelect={() => run(() => useTimerStore.getState().pause())}
                    />
                  ) : (
                    <Item
                      icon={Play}
                      label={timer.status === 'paused' ? 'Resume session' : 'Start focus session'}
                      shortcut="Space"
                      onSelect={() =>
                        run(() => {
                          const store = useTimerStore.getState();
                          if (timer.status === 'paused') store.resume();
                          else void store.startSession('focus');
                          onOpenFocus();
                        })
                      }
                    />
                  )}
                  <Item
                    icon={Maximize2}
                    label="Enter Deep Focus"
                    shortcut="⌘⇧F"
                    onSelect={() => run(onOpenFocus)}
                  />
                  <Item
                    icon={SkipForward}
                    label="Skip to next interval"
                    onSelect={() => run(() => void useTimerStore.getState().skip())}
                  />
                  <Item
                    icon={RotateCcw}
                    label="Reset timer"
                    onSelect={() => run(() => useTimerStore.getState().reset())}
                  />
                  <Item
                    icon={CheckSquare}
                    label="Focus on a task…"
                    onSelect={() => {
                      setPage('tasks');
                      setSearch('');
                    }}
                  />
                  <Item
                    icon={Sliders}
                    label="Switch timer preset…"
                    hint={activePreset?.name ?? 'Custom'}
                    onSelect={() => {
                      setPage('presets');
                      setSearch('');
                    }}
                  />
                </Group>

                <Group heading="Go to" searching={searching}>
                  <Item icon={LayoutDashboard} label="Dashboard" shortcut="⌘1" onSelect={() => run(() => navigate('/dashboard'))} />
                  <Item icon={CheckSquare} label="Tasks" shortcut="⌘2" onSelect={() => run(() => navigate('/tasks'))} />
                  <Item icon={BarChart3} label="Analytics" shortcut="⌘3" onSelect={() => run(() => navigate('/analytics'))} />
                  <Item icon={Trophy} label="Progress" shortcut="⌘4" onSelect={() => run(() => navigate('/achievements'))} />
                  <Item icon={SettingsIcon} label="Settings" shortcut="⌘," onSelect={() => run(() => navigate('/settings'))} />
                </Group>

                <Group heading="Preferences" searching={searching}>
                  <Item
                    icon={Palette}
                    label="Change theme…"
                    onSelect={() => {
                      setPage('themes');
                      setSearch('');
                    }}
                  />
                  <Item
                    icon={settings.soundEnabled ? VolumeX : Volume2}
                    label={settings.soundEnabled ? 'Mute ambient sound' : 'Enable ambient sound'}
                    onSelect={() =>
                      run(() => {
                        const next = !settings.soundEnabled;
                        void updateSettings({ soundEnabled: next });
                        if (!next) ambient.stop();
                        else if (settings.activeSound)
                          void ambient.play(settings.activeSound, settings.soundVolume);
                      })
                    }
                  />
                  <Item
                    icon={Moon}
                    label={settings.reducedMotion ? 'Enable animations' : 'Reduce motion'}
                    onSelect={() => run(() => void updateSettings({ reducedMotion: !settings.reducedMotion }))}
                  />
                  <Item icon={Plus} label="New task" onSelect={() => run(() => navigate('/tasks?new=1'))} />
                </Group>
              </Results>
            )}

            {page === 'themes' && (
              <Group heading="Themes">
                {THEME_OPTIONS.map((t) => (
                  <Item
                    key={t.value}
                    icon={Palette}
                    label={t.label}
                    hint={t.description}
                    active={settings.theme === t.value}
                    onSelect={() => run(() => void updateSettings({ theme: t.value }))}
                  />
                ))}
              </Group>
            )}

            {page === 'presets' && (
              <Group heading="Timer presets">
                {presets.length === 0 && (
                  <div className="px-2 py-6 text-center text-[13px] text-subtle">
                    No presets yet. Save one from Settings.
                  </div>
                )}
                {presets.map((preset) => (
                  <Item
                    key={preset.id}
                    icon={Sliders}
                    label={preset.name}
                    hint={describePreset(preset)}
                    active={activePreset?.id === preset.id}
                    onSelect={() =>
                      run(() => {
                        void applyPreset(preset.id).then((applied) => {
                          if (applied) {
                            toast.success(`Switched to ${applied.name}.`, {
                              description: describePreset(applied),
                            });
                          }
                        });
                      })
                    }
                  />
                ))}
              </Group>
            )}

            {page === 'tasks' && (
              <Group heading="Focus on">
                {openTasks.length === 0 && (
                  <div className="px-2 py-6 text-center text-[13px] text-subtle">
                    No open tasks. Create one first.
                  </div>
                )}
                {openTasks.map((task) => (
                  <Item
                    key={task.id}
                    icon={CheckSquare}
                    label={task.title}
                    hint={`${task.completedSessions}/${task.estimatedSessions} sessions`}
                    onSelect={() =>
                      run(() => {
                        useTimerStore.getState().setTask(task.id, task.title);
                        void useTimerStore.getState().startSession('focus');
                        onOpenFocus();
                      })
                    }
                  />
                ))}
              </Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Holds every result of a multi-section page in one container while a search is
 * running.
 *
 * cmdk ranks items and then reorders them, but only ever within the group they
 * belong to — it moves each item back under `closest('[cmdk-group]')`. Sections
 * therefore cannot interleave, and an item with no group at all is never moved.
 * Collapsing the sections into a single group for the duration of a search is
 * what lets the best match anywhere actually reach the top.
 */
function Results({ searching, children }: { searching: boolean; children: React.ReactNode }) {
  if (!searching) return <>{children}</>;
  return <Command.Group>{children}</Command.Group>;
}

/**
 * A titled section of the command list — while the list is being browsed.
 *
 * cmdk ranks items against each other inside a group but leaves the groups
 * themselves in source order, so with headings on, "Settings" can only ever
 * appear below every Timer command no matter how well it matches: typing "sett"
 * left "Reset timer" selected. Once there is a query the headings stop earning
 * their keep anyway — the user is aiming at one command, not browsing a
 * category — so the sections dissolve into a single ranked list and the best
 * match rises to the top where Enter will hit it.
 */
function Group({
  heading,
  searching = false,
  children,
}: {
  heading: string;
  /** Only for pages that render several sections; see `Results`. */
  searching?: boolean;
  children: React.ReactNode;
}) {
  if (searching) return <>{children}</>;

  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-subtle"
    >
      {children}
    </Command.Group>
  );
}

/**
 * Ranks a command against what has been typed, 0 for no match.
 *
 * cmdk's own scorer is a fuzzy subsequence matcher, which is what you want for
 * "swtprst" → "Switch timer preset" but not for the common case: typing "sett"
 * scored "Reset timer" above "Settings", because those letters happen to fall
 * in order inside it, and "theme" pulled in "Switch timer preset" over "Change
 * theme…". Literal matches are ranked first here — prefix, then word start,
 * then substring — and a scattered subsequence can only ever place below all of
 * them, tie-broken by how short the command is so the tightest match wins.
 */
export function rank(value: string, search: string): number {
  const query = search.trim().toLowerCase();
  if (!query) return 1;

  const haystack = value.toLowerCase();
  // Shorter commands are the better answer among equally literal matches:
  // "Tasks" should beat "Focus on a task…" for "task".
  const brevity = 1 / (1 + haystack.length / 100);

  if (haystack.startsWith(query)) return 0.9 + 0.1 * brevity;
  if (haystack.split(/\s+/).some((word) => word.startsWith(query))) return 0.7 + 0.1 * brevity;
  if (haystack.includes(query)) return 0.5 + 0.1 * brevity;

  // Fall back to a subsequence match — every query letter present, in order —
  // so initials and abbreviations still find their command.
  let at = 0;
  for (const ch of query) {
    at = haystack.indexOf(ch, at);
    if (at === -1) return 0;
    at += 1;
  }
  return 0.1 + 0.1 * brevity;
}

/** One selectable command, with an optional hint, keyboard shortcut, and a dot marking it as the current choice. */
function Item({
  icon: Icon,
  label,
  hint,
  shortcut,
  active,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  shortcut?: string;
  active?: boolean;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-muted transition-colors data-[selected=true]:bg-elevated data-[selected=true]:text-fg"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      {hint && <span className="truncate text-[11px] text-subtle">{hint}</span>}
      <span className="ml-auto flex items-center gap-2">
        {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
        {shortcut && (
          <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-subtle">
            {shortcut}
          </kbd>
        )}
      </span>
    </Command.Item>
  );
}
