import { create } from 'zustand';
import type { Settings, ThemeName, ThemePreference } from '@/types';
import { DEFAULT_SETTINGS, initDb } from '@/db/schema';
import { settingsRepo } from '@/db/repositories';

const DARK_THEMES: ThemeName[] = ['dark', 'midnight', 'amoled', 'forest', 'ocean', 'sunset'];

/** Whether a concrete theme is a dark one — decides the light/dark mode flag the CSS keys off. */
export function isDarkTheme(theme: ThemeName): boolean {
  return DARK_THEMES.includes(theme);
}

/**
 * Whether the operating system is asking for less motion.
 *
 * The Settings screen has always said this is respected automatically, and the
 * CSS half of it was: `@media (prefers-reduced-motion: reduce)` strips
 * transitions. But the ambient orbs, the drifting background washes and the
 * spring on the nav indicator are all Framer Motion, driven from JavaScript,
 * and those only ever consulted the in-app switch — so the strongest motion in
 * the app ignored the setting the user had already expressed to their OS.
 */
export function systemReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  /**
   * Whether motion should actually be reduced: the in-app switch, or the OS
   * asking for it. The switch stays an override that can only add reduction —
   * turning it off cannot overrule what the user told their operating system.
   */
  reducedMotion: boolean;
  /** True when the OS is the reason motion is reduced, so Settings can say so. */
  systemReducedMotion: boolean;
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

/**
 * Writes theme/motion/contrast to the document root, where the CSS reads them.
 *
 * `reducedMotion` is passed in rather than re-derived here: the store has
 * already combined the in-app switch with the OS preference, and asking the
 * media query a second time gives the answer two places to disagree.
 */
function paint(settings: Settings, reducedMotion: boolean): ThemeName {
  const theme = resolveTheme(settings.theme);
  const mode = isDarkTheme(theme) ? 'dark' : 'light';
  const motion = reducedMotion ? 'reduced' : 'full';
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
  reducedMotion: false,
  systemReducedMotion: false,

  /** Opens the database, reads settings (seeding defaults on first run), paints the theme, and starts following the OS appearance. */
  load: async () => {
    const settings = await initDb();
    const system = systemReducedMotion();
    const reduced = settings.reducedMotion || system;
    set({
      settings,
      loaded: true,
      resolvedTheme: paint(settings, reduced),
      systemReducedMotion: system,
      reducedMotion: reduced,
    });

    // Follow the OS when the user hasn't pinned a theme.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (get().settings.theme === 'system') {
        set({ resolvedTheme: paint(get().settings, get().reducedMotion) });
      }
    });

    // And follow it for motion, which can be switched mid-session — it is an
    // accessibility control on every desktop OS, not a set-once preference.
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => {
      const nowReduced = get().settings.reducedMotion || event.matches;
      set({ systemReducedMotion: event.matches, reducedMotion: nowReduced });
      paint(get().settings, nowReduced);
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
    const reduced = next.reducedMotion || get().systemReducedMotion;
    set({ settings: next, resolvedTheme: paint(next, reduced), reducedMotion: reduced });
    await settingsRepo.patch(patch);
  },

  /** Re-paints the document from the current settings, e.g. after the OS appearance changes. */
  applyTheme: () => {
    set({ resolvedTheme: paint(get().settings, get().reducedMotion) });
  },
}));
