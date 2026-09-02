import {
  BarChart3,
  Brain,
  Focus,
  ListChecks,
  Palette,
  Sparkles,
  Trophy,
  Volume2,
  type LucideIcon,
} from 'lucide-react';

export interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Shown as a small pill on the card — the concrete detail that makes the claim credible. */
  tag: string;
}

/**
 * The feature set as pitched to a first-time visitor. Every claim here has to
 * be true of the shipped app — a landing page that oversells is worse than no
 * landing page, because the let-down lands on the first session.
 */
export const FEATURES: Feature[] = [
  {
    icon: Focus,
    title: 'Deep Focus Mode',
    body: 'A full-screen countdown with an ambient drift background and your task title. Float it over any other window with picture-in-picture so the clock stays visible while you work.',
    tag: 'Picture-in-picture',
  },
  {
    icon: Brain,
    title: 'An engine that learns you',
    body: 'After about ten sessions it reads your own history: the session length you actually finish, the break length that leaves you sharp, and the three-hour window where your focus is strongest.',
    tag: 'Shows its reasoning',
  },
  {
    icon: BarChart3,
    title: 'Analytics worth reading',
    body: 'Focus over time, your best hours, how mood predicts productivity, and what interrupts you — including how far into a session each distraction tends to hit.',
    tag: 'Day / week / month / year',
  },
  {
    icon: Sparkles,
    title: 'A written daily debrief',
    body: 'An end-of-day reflection assembled from rules, not a language model. Every sentence traces back to a number in your log, so it works offline and never invents a fact.',
    tag: 'No AI, no API',
  },
  {
    icon: ListChecks,
    title: 'Tasks that drive the plan',
    body: 'Priorities, categories, tags, and session estimates. Drag to reorder and the daily plan follows — your highest-priority work scheduled into your peak window.',
    tag: 'Auto-ordered plan',
  },
  {
    icon: Volume2,
    title: 'Soundscapes, synthesized live',
    body: 'Rain, forest, ocean, coffee shop, fireplace, wind, white and brown noise — generated in the browser from filtered noise and oscillators. Nothing downloads, nothing loops audibly.',
    tag: '8 soundscapes',
  },
  {
    icon: Trophy,
    title: 'Progress you can feel',
    body: 'Earn XP per session, scaled by length, with a bonus for distraction-free ones. Thirteen achievements across bronze, silver, gold and platinum, each showing live progress.',
    tag: '13 achievements',
  },
  {
    icon: Palette,
    title: 'Nine themes, real accessibility',
    body: 'Light, Minimal, Lavender, Dark, Midnight, AMOLED, Forest, Ocean and Sunset — plus System. Full keyboard navigation, high-contrast and reduce-motion modes throughout.',
    tag: 'Follows your OS',
  },
];

export interface Step {
  n: string;
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    n: '01',
    title: 'Add what you are working on',
    body: 'Give it a priority, a category, and a rough estimate in sessions. A specific title focuses better than a vague one.',
  },
  {
    n: '02',
    title: 'Start the session',
    body: 'A two-tap check-in asks how you feel, then Deep Focus takes the screen. Log a distraction with one key without breaking flow.',
  },
  {
    n: '03',
    title: 'Read what it noticed',
    body: 'Your debrief lands at the end of the day, and the analytics fill in over weeks — until the app is tuning your cadence to what you genuinely finish.',
  },
];

export interface StatChip {
  value: string;
  label: string;
}

export const STATS: StatChip[] = [
  { value: '100%', label: 'Runs offline' },
  { value: '0', label: 'Accounts needed' },
  { value: '9', label: 'Themes' },
  { value: '8', label: 'Soundscapes' },
];

/** Where to reach the person who built this. */
export const CREATOR = {
  name: 'Shankha Shubhra Das',
  role: 'Designer & developer of FocusOS',
  blurb:
    'FocusOS started as a timer I wanted for my own work and grew into the whole focus workflow. It has no backend, no tracking, and no business model — just a tool I use every day. If it helps you too, I would genuinely like to hear about it.',
  email: 'shankhasdas07@gmail.com',
  github: 'https://github.com/shankha007',
} as const;
