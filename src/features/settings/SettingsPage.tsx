import { useState } from 'react';
import { toast } from 'sonner';
import {
  Bell,
  Check,
  CloudOff,
  Contrast,
  Download,
  Droplet,
  Eye,
  Palette,
  Sliders,
  Timer,
  Trash2,
  Upload,
  Volume2,
  Zap,
} from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Badge,
  Card,
  CardDescription,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Slider,
  Switch,
} from '@/components/ui/primitives';
import { SoundPicker } from '@/features/focus/SoundPicker';
import { CategoryPresetMap, PresetManager } from './PresetManager';
import { RestoreDialog } from './RestoreDialog';
import { THEME_OPTIONS } from './themes';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useStatsStore } from '@/store/useStatsStore';
import { clearPersistedTimer } from '@/store/useTimerStore';
import { usePresetStore, describePreset, matchesSettings } from '@/store/usePresetStore';
import { clearAllData } from '@/db/repositories';
import { exportJson } from '@/lib/export';
import { requestNotificationPermission, notificationPermission } from '@/lib/notifications';
import { MINUTE, cn, clamp } from '@/lib/utils';

/** Every preference in one page: timer cadence and presets, appearance, sound, notifications, check-in prompts, adaptive suggestions, and the backup / restore / reset controls. */
export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const presets = usePresetStore((s) => s.presets);
  const systemReducedMotion = useSettingsStore((st) => st.systemReducedMotion);
  const [confirmReset, setConfirmReset] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const activePreset = presets.find((p) => matchesSettings(p, settings)) ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        subtitle="Everything is stored on this device. Nothing leaves your browser."
      />

      <div className="space-y-4">
        {/* ── Timer ─────────────────────────────────────────── */}
        <Section
          icon={Timer}
          title="Timer"
          description="Session and break lengths."
          aside={
            <Badge
              tone={activePreset ? 'accent' : 'muted'}
              title={activePreset ? describePreset(activePreset) : undefined}
            >
              {activePreset ? activePreset.name : 'Custom'}
            </Badge>
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <MinuteField
              label="Focus"
              value={settings.focusMs}
              min={5}
              max={120}
              onChange={(ms) => void update({ focusMs: ms })}
            />
            <MinuteField
              label="Short break"
              value={settings.shortBreakMs}
              min={1}
              max={30}
              onChange={(ms) => void update({ shortBreakMs: ms })}
            />
            <MinuteField
              label="Long break"
              value={settings.longBreakMs}
              min={5}
              max={60}
              onChange={(ms) => void update({ longBreakMs: ms })}
            />
          </div>

          <div className="mt-5 space-y-1">
            <SettingRow
              label="Sessions until a long break"
              description="The classic Pomodoro cadence is four."
            >
              <NumberStepper
                value={settings.sessionsUntilLongBreak}
                min={2}
                max={8}
                onChange={(v) => void update({ sessionsUntilLongBreak: v })}
              />
            </SettingRow>

            <SettingRow label="Daily session goal" description="Drives your focus score and streak.">
              <NumberStepper
                value={settings.dailyGoalSessions}
                min={1}
                max={20}
                onChange={(v) => void update({ dailyGoalSessions: v })}
              />
            </SettingRow>

            <SettingRow
              label="Auto-start breaks"
              description="Roll into a break the moment focus ends."
            >
              <Switch
                checked={settings.autoStartBreaks}
                onCheckedChange={(v) => void update({ autoStartBreaks: v })}
              />
            </SettingRow>

            <SettingRow
              label="Auto-start focus"
              description="Jump straight back in after a break. Off by default — breaks should end deliberately."
            >
              <Switch
                checked={settings.autoStartFocus}
                onCheckedChange={(v) => void update({ autoStartFocus: v })}
              />
            </SettingRow>
          </div>
        </Section>

        {/* ── Presets ───────────────────────────────────────── */}
        <Section
          icon={Sliders}
          title="Timer presets"
          description="Named cadences you can switch between — 25/5 for admin, 90/20 for deep work."
        >
          <PresetManager />

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[13px] font-medium">Per-category cadence</p>
            <p className="mb-3 mt-0.5 text-[12px] leading-relaxed text-muted">
              Focusing on a task in one of these categories switches the timer to its preset first.
            </p>
            <CategoryPresetMap />
          </div>
        </Section>

        {/* ── Appearance ────────────────────────────────────── */}
        <Section icon={Palette} title="Appearance" description="Nine themes, plus system matching.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {THEME_OPTIONS.map((theme) => {
              const active = settings.theme === theme.value;
              return (
                <button
                  key={theme.value}
                  onClick={() => void update({ theme: theme.value })}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border p-3 text-left transition-all',
                    active
                      ? 'border-accent shadow-glow'
                      : 'border-border hover:border-subtle/40 hover:shadow-soft',
                  )}
                  aria-pressed={active}
                >
                  <div className="flex gap-1">
                    {theme.swatch.map((color, i) => (
                      <span
                        key={i}
                        className="h-6 flex-1 rounded-md border border-black/5"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[12px] font-medium">
                    {theme.label}
                    {active && <Check className="h-3 w-3 text-accent" />}
                  </p>
                  <p className="truncate text-[11px] text-subtle">{theme.description}</p>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Sound ─────────────────────────────────────────── */}
        <Section
          icon={Volume2}
          title="Ambient sound"
          description="Generated live in your browser — no downloads, works offline."
        >
          <SoundPicker />
          <div className="mt-4 space-y-1">
            <SettingRow label="Completion chime" description="A soft tone when a session ends.">
              <Switch
                checked={settings.chimeEnabled}
                onCheckedChange={(v) => void update({ chimeEnabled: v })}
              />
            </SettingRow>
          </div>
        </Section>

        {/* ── Session flow ──────────────────────────────────── */}
        <Section
          icon={Zap}
          title="Session check-ins"
          description="These two prompts are what make the analytics and adaptive suggestions work."
        >
          <div className="space-y-1">
            <SettingRow
              label="Ask mood before sessions"
              description="Two taps. Unlocks the mood-vs-productivity analysis."
            >
              <Switch
                checked={settings.askMoodBefore}
                onCheckedChange={(v) => void update({ askMoodBefore: v })}
              />
            </SettingRow>
            <SettingRow
              label="Ask productivity after sessions"
              description="Feeds your focus score, reflections, and session-length recommendations."
            >
              <Switch
                checked={settings.askProductivityAfter}
                onCheckedChange={(v) => void update({ askProductivityAfter: v })}
              />
            </SettingRow>
            <SettingRow
              label="Adaptive recommendations"
              description="Learn optimal session lengths and peak hours from your history."
            >
              <Switch
                checked={settings.adaptiveEnabled}
                onCheckedChange={(v) => void update({ adaptiveEnabled: v })}
              />
            </SettingRow>
          </div>
        </Section>

        {/* ── Breaks ────────────────────────────────────────── */}
        <Section
          icon={Droplet}
          title="Breaks"
          description="What happens in the gaps between sessions."
        >
          <div className="space-y-1">
            <SettingRow
              label="Water break reminder"
              description="Shows a one-tap water tracker during short and long breaks."
            >
              <Switch
                checked={settings.hydrationEnabled}
                onCheckedChange={(v) => void update({ hydrationEnabled: v })}
              />
            </SettingRow>
            <SettingRow
              label="Daily water goal"
              description="Glasses to aim for. The count resets at midnight."
            >
              <NumberStepper
                value={settings.dailyGlassGoal}
                min={1}
                max={16}
                onChange={(v) => void update({ dailyGlassGoal: v })}
              />
            </SettingRow>
          </div>
        </Section>

        {/* ── Notifications ─────────────────────────────────── */}
        <Section icon={Bell} title="Notifications" description="Get told when a session ends.">
          <SettingRow
            label="Browser notifications"
            description={
              notificationPermission() === 'denied'
                ? 'Blocked in your browser settings — you will need to re-enable it there.'
                : 'Fires when focus or a break completes.'
            }
          >
            <Switch
              checked={settings.notificationsEnabled}
              disabled={notificationPermission() === 'denied'}
              onCheckedChange={async (v) => {
                if (v) {
                  const granted = await requestNotificationPermission();
                  if (!granted) {
                    toast.error('Notification permission was not granted.');
                    return;
                  }
                }
                void update({ notificationsEnabled: v });
              }}
            />
          </SettingRow>
        </Section>

        {/* ── Accessibility ─────────────────────────────────── */}
        <Section icon={Eye} title="Accessibility" description="Adjust motion and contrast.">
          <div className="space-y-1">
            <SettingRow
              label="Reduce motion"
              description={
                systemReducedMotion
                  ? 'Your system is already set to reduce motion, so ambient animation is off. This switch cannot turn it back on.'
                  : 'Removes ambient animation and transitions. Your system setting turns this on automatically.'
              }
            >
              <Switch
                checked={settings.reducedMotion || systemReducedMotion}
                // The OS asking for less motion is not something an in-app
                // switch should be able to overrule, so the control reads as on
                // and locked rather than quietly doing nothing.
                disabled={systemReducedMotion}
                onCheckedChange={(v) => void update({ reducedMotion: v })}
              />
            </SettingRow>
            <SettingRow
              label="High contrast"
              description="Strengthens borders and secondary text."
            >
              <span className="flex items-center gap-2">
                <Contrast className="h-3.5 w-3.5 text-subtle" />
                <Switch
                  checked={settings.highContrast}
                  onCheckedChange={(v) => void update({ highContrast: v })}
                />
              </span>
            </SettingRow>
          </div>
        </Section>

        {/* ── Data ──────────────────────────────────────────── */}
        <Section icon={Download} title="Your data" description="It lives in this browser's IndexedDB.">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void exportJson()}>
              <Download className="h-3.5 w-3.5" />
              Export everything
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRestoreOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Restore from backup
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Reset all data
            </Button>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Clearing your browser's site data erases everything here permanently — an export is the
            only way back. Restore reads that same JSON file on this or any other device.
          </p>

          <div className="mt-4 rounded-xl border border-border bg-elevated/50 p-3.5">
            <div className="flex items-start gap-2.5">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
              <div>
                <p className="flex items-center gap-2 text-[13px] font-medium">
                  Cloud sync
                  <Badge tone="muted">Not connected</Badge>
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  FocusOS runs entirely offline. Everything you log stays in this browser and is
                  never sent anywhere. To move your history to another device, use the JSON export
                  above.
                </p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <ResetDialog open={confirmReset} onOpenChange={setConfirmReset} />
      <RestoreDialog open={restoreOpen} onOpenChange={setRestoreOpen} />
    </PageContainer>
  );
}

/* ── Building blocks ───────────────────────────────────────── */

/** A titled group of settings, with an icon and a line explaining what the group is for. */
function Section({
  icon: Icon,
  title,
  description,
  aside,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-elevated text-muted">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children}
    </Card>
  );
}

/** One setting: label and explanation on the left, its control on the right. */
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {description && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** A slider for a duration, stored in milliseconds but edited in whole minutes. */
function MinuteField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (ms: number) => void;
}) {
  const minutes = Math.round(value / MINUTE);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-[13px] font-medium">{label}</label>
        <span className="tabular text-[13px] text-muted">{minutes} min</span>
      </div>
      <Slider
        value={[minutes]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v * MINUTE)}
        aria-label={`${label} length in minutes`}
      />
    </div>
  );
}

/** A small −/+ control for a count, clamped to the given range. */
function NumberStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex h-9 w-[104px] items-center justify-between rounded-xl border border-border bg-bg px-1">
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => onChange(clamp(value - 1, min, max))}
        aria-label="Decrease"
      >
        −
      </Button>
      <span className="tabular text-sm font-medium">{value}</span>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => onChange(clamp(value + 1, min, max))}
        aria-label="Increase"
      >
        +
      </Button>
    </div>
  );
}

/** Erases the user's history. Destructive and irreversible, so it asks for the word "reset" to be typed before the button works. */
function ResetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [confirmText, setConfirmText] = useState('');

  /** Clears the data, reloads the stores, and drops any timer left in localStorage. */
  const reset = async () => {
    await clearAllData();
    await Promise.all([useTaskStore.getState().load(), useStatsStore.getState().refresh()]);
    await useSettingsStore.getState().update({ xp: 0 });
    clearPersistedTimer();
    setConfirmText('');
    onOpenChange(false);
    toast.success('All data cleared.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Reset all data?</DialogTitle>
        <DialogDescription>
          This permanently deletes every task, session, distraction, and badge on this device. It
          cannot be undone. Export a backup first if you might want any of it back.
        </DialogDescription>

        <div className="mt-4">
          <label htmlFor="confirm" className="mb-1.5 block text-[13px] font-medium">
            Type <span className="font-mono text-danger">reset</span> to confirm
          </label>
          <Input
            id="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="reset"
            autoComplete="off"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={confirmText !== 'reset'} onClick={() => void reset()}>
            Delete everything
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
