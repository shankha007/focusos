import { Volume2, VolumeX } from 'lucide-react';
import { SOUNDS, ambient } from '@/lib/audio';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Slider } from '@/components/ui/primitives';
import { DynamicIcon } from '@/components/DynamicIcon';
import type { SoundId } from '@/types';
import { cn } from '@/lib/utils';

export function SoundPicker({ compact = false }: { compact?: boolean }) {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  const select = async (id: SoundId) => {
    if (settings.activeSound === id && settings.soundEnabled) {
      ambient.stop();
      await update({ activeSound: null, soundEnabled: false });
      return;
    }
    await update({ activeSound: id, soundEnabled: true });
    // Browsers require a user gesture before audio can start — this click is it.
    void ambient.play(id, settings.soundVolume);
  };

  return (
    <div className="space-y-3">
      <div className={cn('grid gap-1.5', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        {SOUNDS.map((sound) => {
          const active = settings.soundEnabled && settings.activeSound === sound.id;
          return (
            <button
              key={sound.id}
              onClick={() => void select(sound.id)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all',
                active
                  ? 'border-accent bg-accent/10 text-fg'
                  : 'border-border text-muted hover:border-subtle/40 hover:bg-elevated hover:text-fg',
              )}
            >
              <DynamicIcon
                name={sound.icon}
                className={cn('h-4 w-4 shrink-0', active && 'text-accent')}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">{sound.label}</span>
                {!compact && (
                  <span className="block truncate text-[11px] text-subtle">{sound.description}</span>
                )}
              </span>
              {active && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => {
            const next = !settings.soundEnabled;
            void update({ soundEnabled: next });
            if (!next) ambient.stop();
            else if (settings.activeSound) void ambient.play(settings.activeSound, settings.soundVolume);
          }}
          className="text-subtle transition-colors hover:text-fg"
          aria-label={settings.soundEnabled ? 'Mute' : 'Unmute'}
        >
          {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <Slider
          value={[settings.soundVolume * 100]}
          max={100}
          step={1}
          onValueChange={([v]) => {
            const vol = v / 100;
            ambient.setVolume(vol);
            void update({ soundVolume: vol });
          }}
          aria-label="Ambient volume"
        />
        <span className="tabular w-8 text-right text-[11px] text-subtle">
          {Math.round(settings.soundVolume * 100)}
        </span>
      </div>
    </div>
  );
}
