import type { SessionType } from '@/types';

export type BreakKind = 'stretch' | 'hydrate' | 'eyes' | 'breathe' | 'move' | 'reset';

export interface BreakSuggestion {
  id: string;
  kind: BreakKind;
  title: string;
  detail: string;
  icon: string;
  /** Roughly how long it takes, in seconds. */
  seconds: number;
}

const SUGGESTIONS: BreakSuggestion[] = [
  {
    id: 'eyes-20',
    kind: 'eyes',
    title: '20-20-20',
    detail: 'Look at something 20 feet away for 20 seconds. It resets the focusing muscles in your eyes.',
    icon: 'Eye',
    seconds: 20,
  },
  {
    id: 'stretch-neck',
    kind: 'stretch',
    title: 'Neck and shoulders',
    detail: 'Roll your shoulders back five times, then tilt your head gently to each side.',
    icon: 'PersonStanding',
    seconds: 45,
  },
  {
    id: 'hydrate',
    kind: 'hydrate',
    title: 'Drink some water',
    detail: 'A full glass. Mild dehydration measurably dents concentration.',
    icon: 'Droplets',
    seconds: 30,
  },
  {
    id: 'breathe-478',
    kind: 'breathe',
    title: '4-7-8 breathing',
    detail: 'In for 4, hold for 7, out for 8. Four rounds drops your heart rate noticeably.',
    icon: 'Wind',
    seconds: 76,
  },
  {
    id: 'stretch-wrists',
    kind: 'stretch',
    title: 'Wrists and hands',
    detail: 'Extend one arm, pull the fingers gently back, hold fifteen seconds. Swap sides.',
    icon: 'Hand',
    seconds: 40,
  },
  {
    id: 'move-walk',
    kind: 'move',
    title: 'Walk it out',
    detail: 'Stand and walk, even if only to the next room and back. Movement clears the buffer.',
    icon: 'Footprints',
    seconds: 120,
  },
  {
    id: 'stretch-back',
    kind: 'stretch',
    title: 'Open your chest',
    detail: 'Clasp your hands behind your back, straighten your arms, and lift slightly.',
    icon: 'StretchHorizontal',
    seconds: 35,
  },
  {
    id: 'reset-desk',
    kind: 'reset',
    title: 'Clear the desk',
    detail: 'Ten seconds tidying your workspace. A clean surface makes restarting easier.',
    icon: 'Eraser',
    seconds: 30,
  },
];

/**
 * Picks a suggestion suited to the break's length and how long the user has
 * been sitting. Long breaks favour actually getting up; short ones stay at the
 * desk so the break doesn't overrun.
 */
export function suggestBreak(
  type: SessionType,
  consecutiveSessions: number,
  seed = Date.now(),
): BreakSuggestion {
  const pool = SUGGESTIONS.filter((s) => {
    if (type === 'long-break') return true;
    return s.seconds <= 80;
  });

  // After a few sessions back to back, prioritise getting out of the chair.
  const preferred =
    consecutiveSessions >= 3
      ? pool.filter((s) => s.kind === 'move' || s.kind === 'stretch')
      : pool;

  const list = preferred.length > 0 ? preferred : pool;
  return list[Math.floor(seed / 1000) % list.length];
}

export function allBreakSuggestions(): BreakSuggestion[] {
  return SUGGESTIONS;
}

/** Phases for the guided breathing animation, in seconds. */
export const BREATH_PATTERN = [
  { label: 'Breathe in', seconds: 4 },
  { label: 'Hold', seconds: 7 },
  { label: 'Breathe out', seconds: 8 },
] as const;
