import type { ThemePreference } from '@/types';

export interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
  /** Swatch colors: [background, surface, accent] */
  swatch: [string, string, string];
  dark: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'system',
    label: 'System',
    description: 'Follows your OS appearance',
    swatch: ['#f8f8fb', '#0b0c14', '#7886ff'],
    dark: false,
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Clean and neutral',
    swatch: ['#f8f8fb', '#ffffff', '#5856d6'],
    dark: false,
  },
  {
    value: 'minimal',
    label: 'Minimal White',
    description: 'Pure white, monochrome accents',
    swatch: ['#ffffff', '#fcfcfd', '#18181b'],
    dark: false,
  },
  {
    value: 'lavender',
    label: 'Lavender',
    description: 'Soft violet daylight',
    swatch: ['#f5f3fc', '#ffffff', '#6e46e2'],
    dark: false,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Balanced neutral dark',
    swatch: ['#141418', '#1c1c21', '#8785f5'],
    dark: true,
  },
  {
    value: 'midnight',
    label: 'Midnight',
    description: 'Deep blue, low glare',
    swatch: ['#0b0c14', '#121420', '#7886ff'],
    dark: true,
  },
  {
    value: 'amoled',
    label: 'AMOLED',
    description: 'True black, saves power',
    swatch: ['#000000', '#08080a', '#6cd6ff'],
    dark: true,
  },
  {
    value: 'forest',
    label: 'Forest',
    description: 'Muted greens, calm',
    swatch: ['#0d1612', '#131f19', '#6ac882'],
    dark: true,
  },
  {
    value: 'ocean',
    label: 'Ocean',
    description: 'Cool deep-water blues',
    swatch: ['#091420', '#0e1d2d', '#56b2ff'],
    dark: true,
  },
  {
    value: 'sunset',
    label: 'Sunset',
    description: 'Warm amber and rose',
    swatch: ['#1a1014', '#25171c', '#ff8a60'],
    dark: true,
  },
];
