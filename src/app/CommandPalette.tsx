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
import type { ThemePreference } from '@/types';
import { THEME_OPTIONS } from '@/features/settings/themes';
import { toast } from 'sonner';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFocus: () => void;
}

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

  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived');
  const activePreset = presets.find((p) => matchesSettings(p, settings)) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="top-[18%] max-w-xl translate-y-0 p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          loop
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
              <>
                <Group heading="Timer">
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

                <Group heading="Go to">
                  <Item icon={LayoutDashboard} label="Dashboard" shortcut="⌘1" onSelect={() => run(() => navigate('/'))} />
                  <Item icon={CheckSquare} label="Tasks" shortcut="⌘2" onSelect={() => run(() => navigate('/tasks'))} />
                  <Item icon={BarChart3} label="Analytics" shortcut="⌘3" onSelect={() => run(() => navigate('/analytics'))} />
                  <Item icon={Trophy} label="Progress" shortcut="⌘4" onSelect={() => run(() => navigate('/achievements'))} />
                  <Item icon={SettingsIcon} label="Settings" shortcut="⌘," onSelect={() => run(() => navigate('/settings'))} />
                </Group>

                <Group heading="Preferences">
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
              </>
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
                    onSelect={() => run(() => void updateSettings({ theme: t.value as ThemePreference }))}
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

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-subtle"
    >
      {children}
    </Command.Group>
  );
}

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
