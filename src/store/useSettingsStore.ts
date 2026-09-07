import { create } from 'zustand';
import type { Settings, ThemeName, ThemePreference } from '@/types';
import { DEFAULT_SETTINGS, initDb } from '@/db/schema';
import { settingsRepo } from '@/db/repositories';

const DARK_THEMES: ThemeName[] = ['dark', 'midnight', 'amoled', 'forest', 'ocean', 'sunset'];

/** Whether a concrete theme is a dark one — decides the light/dark mode flag the CSS keys off. */
export function isDarkTheme(theme: ThemeName): boolean {
  return DARK_THEMES.includes(theme);
}

/** The theme matching the OS appearance right now. */
export function systemTheme(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'light';
}

/** Turns the stored preference into the theme to actually render, following the OS when it is set to 'system'. */
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

/**
 * Where the appearance is mirrored for the inline script in index.html.
 *
 * The preferences themselves live in IndexedDB, which cannot be read before the
 * first paint and is not opened at all on the landing page. Without this the
 * document would render under the theme hard-coded in index.html until the
 * database answered — a dark flash for anyone on a light theme, and the wrong
 * theme entirely for the whole of the landing page.
 */
const APPEARANCE_KEY = 'focusos:appearance';

/** Writes theme/motion/contrast to the document root, where the CSS reads them. */
function paint(settings: Settings): ThemeName {
  const theme = resolveTheme(settings.theme);
  const mode = isDarkTheme(theme) ? 'dark' : 'light';
  const motion = settings.reducedMotion ? 'reduced' : 'full';
  const contrast = settings.highContrast ? 'high' : 'normal';

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = mode;
  root.dataset.motion = motion;
  root.dataset.contrast = contrast;

  // The stored preference travels alongside the resolved theme: 'system' has to
  // be re-resolved against the OS at load, since it may have changed while the
  // tab was closed. Keep the resolution here in step with the copy in
  // index.html.
  try {
    localStorage.setItem(
      APPEARANCE_KEY,
      JSON.stringify({ pref: settings.theme, theme, mode, motion, contrast }),
    );
  } catch {
    // Storage can be unavailable or full. The app still paints correctly; only
    // the head start on the next load is lost.
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', `rgb(${bg.replace(/\s+/g, ',')})`);
  }
  return theme;
}

/** Every user preference, plus the resolved theme currently painted on the document. */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  resolvedTheme: 'midnight',

  /** Opens the database, reads settings (seeding defaults on first run), paints the theme, and starts following the OS appearance. */
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

  /** Saves changed preferences and repaints. Editing a timer duration by hand detaches the active preset label, since the settings are no longer that preset. */
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

  /** Re-paints the document from the current settings, e.g. after the OS appearance changes. */
  applyTheme: () => {
    set({ resolvedTheme: paint(get().settings) });
  },
}));
