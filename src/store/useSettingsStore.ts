import { create } from 'zustand';
import type { Settings, ThemeName, ThemePreference } from '@/types';
import { DEFAULT_SETTINGS, initDb } from '@/db/schema';
import { settingsRepo } from '@/db/repositories';

const DARK_THEMES: ThemeName[] = ['dark', 'midnight', 'amoled', 'forest', 'ocean', 'sunset'];

export function isDarkTheme(theme: ThemeName): boolean {
  return DARK_THEMES.includes(theme);
}

export function systemTheme(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'light';
}

export function resolveTheme(pref: ThemePreference): ThemeName {
  return pref === 'system' ? systemTheme() : pref;
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  resolvedTheme: ThemeName;
  applyTheme: () => void;
}

/** Writes theme/motion/contrast to the document root, where the CSS reads them. */
function paint(settings: Settings): ThemeName {
  const theme = resolveTheme(settings.theme);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = isDarkTheme(theme) ? 'dark' : 'light';
  root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  root.dataset.contrast = settings.highContrast ? 'high' : 'normal';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', `rgb(${bg.replace(/\s+/g, ',')})`);
  }
  return theme;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  resolvedTheme: 'midnight',

  load: async () => {
    const settings = await initDb();
    set({ settings, loaded: true, resolvedTheme: paint(settings) });

    // Follow the OS when the user hasn't pinned a theme.
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (get().settings.theme === 'system') {
          set({ resolvedTheme: paint(get().settings) });
        }
      });
  },

  update: async (patch) => {
    // Hand-editing any of the four cadence fields detaches the preset label:
    // the settings no longer are that preset, so claiming they are would be a
    // lie the rest of the app reads. Applying a preset passes activePresetId
    // in the same patch, which opts out of this.
    const PRESET_FIELDS = [
      'focusMs',
      'shortBreakMs',
      'longBreakMs',
      'sessionsUntilLongBreak',
    ] as const;
    if (
      !('activePresetId' in patch) &&
      PRESET_FIELDS.some((field) => field in patch) &&
      get().settings.activePresetId !== null
    ) {
      patch = { ...patch, activePresetId: null };
    }

    const next = { ...get().settings, ...patch };
    set({ settings: next, resolvedTheme: paint(next) });
    await settingsRepo.patch(patch);
  },

  applyTheme: () => {
    set({ resolvedTheme: paint(get().settings) });
  },
}));
