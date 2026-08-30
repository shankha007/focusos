import { create } from 'zustand';
import type { Category, Settings, TimerPreset } from '@/types';
import { presetsRepo } from '@/db/repositories';
import { MINUTE } from '@/lib/utils';
import { useSettingsStore } from './useSettingsStore';

/** The four settings a preset owns. Everything else is left alone. */
export type PresetShape = Pick<
  Settings,
  'focusMs' | 'shortBreakMs' | 'longBreakMs' | 'sessionsUntilLongBreak'
>;

/** Extracts just the four settings a preset controls, ready to merge into settings. */
export function presetShape(preset: TimerPreset): PresetShape {
  return {
    focusMs: preset.focusMs,
    shortBreakMs: preset.shortBreakMs,
    longBreakMs: preset.longBreakMs,
    sessionsUntilLongBreak: preset.sessionsUntilLongBreak,
  };
}

/** "50 / 10 · long 20 after 3" — the whole cadence at a glance. */
export function describePreset(preset: PresetShape & { name?: string }): string {
  const m = (ms: number) => Math.round(ms / MINUTE);
  return `${m(preset.focusMs)} / ${m(preset.shortBreakMs)} · long ${m(preset.longBreakMs)} after ${preset.sessionsUntilLongBreak}`;
}

/** True when the live settings still match what the preset would set. */
export function matchesSettings(preset: TimerPreset, settings: Settings): boolean {
  const shape = presetShape(preset);
  return (Object.keys(shape) as (keyof PresetShape)[]).every((k) => shape[k] === settings[k]);
}

interface PresetStoreState {
  presets: TimerPreset[];
  loaded: boolean;

  load: () => Promise<void>;
  create: (input: PresetShape & { name: string }) => Promise<TimerPreset>;
  update: (id: string, patch: Partial<TimerPreset>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Copies the preset's four fields into settings. No-op if it's gone. */
  apply: (id: string) => Promise<TimerPreset | null>;
}

/** The saved timer presets, and the one action that puts a preset into force. */
export const usePresetStore = create<PresetStoreState>((set, get) => ({
  presets: [],
  loaded: false,

  /** Reads every preset from the database. Run once at startup. */
  load: async () => {
    set({ presets: await presetsRepo.all(), loaded: true });
  },

  /** Saves a new custom preset and returns it. */
  create: async (input) => {
    const preset = await presetsRepo.create(input);
    set({ presets: await presetsRepo.all() });
    return preset;
  },

  /** Edits a preset, and re-applies it to settings if it happens to be the one in force. */
  update: async (id, patch) => {
    await presetsRepo.update(id, patch);
    set({ presets: await presetsRepo.all() });

    // Retuning the preset that's currently in force should move the timer with
    // it — otherwise settings and the preset it claims to be drift apart.
    const settings = useSettingsStore.getState().settings;
    if (settings.activePresetId === id) {
      const next = get().presets.find((p) => p.id === id);
      if (next) await useSettingsStore.getState().update(presetShape(next));
    }
  },

  /** Deletes a preset. The current durations stay put; only the label naming that preset is cleared. */
  remove: async (id) => {
    await presetsRepo.remove(id);
    set({ presets: await presetsRepo.all() });
    // The durations stay as they are; only the "this came from a preset" label
    // is dropped, since the preset it named no longer exists.
    if (useSettingsStore.getState().settings.activePresetId === id) {
      await useSettingsStore.getState().update({ activePresetId: null });
    }
  },

  /** Puts a preset into force and returns it, or null if that preset no longer exists. */
  apply: async (id) => {
    const preset = get().presets.find((p) => p.id === id) ?? (await presetsRepo.get(id)) ?? null;
    if (!preset) return null;
    await useSettingsStore.getState().update({ ...presetShape(preset), activePresetId: id });
    return preset;
  },
}));

/**
 * Applies the preset attached to a task's category, if there is one. Called
 * from the timer store just before a focus session starts, so every entry point
 * — dashboard, task row, command palette — picks up the cadence.
 *
 * Returns the preset that was applied, or null when nothing changed.
 */
export async function applyPresetForCategory(
  categoryId: string | undefined,
  categories: Category[],
): Promise<TimerPreset | null> {
  if (!categoryId) return null;
  const presetId = categories.find((c) => c.id === categoryId)?.presetId;
  if (!presetId) return null;

  const { presets } = usePresetStore.getState();
  const preset = presets.find((p) => p.id === presetId);
  // Already in force — skip the write so starting a session doesn't churn
  // settings (and the subscriber that retunes an idle timer) for nothing.
  if (!preset || matchesSettings(preset, useSettingsStore.getState().settings)) return null;

  return usePresetStore.getState().apply(presetId);
}
