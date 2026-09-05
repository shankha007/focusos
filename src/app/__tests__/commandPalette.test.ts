import { describe, expect, it } from 'vitest';
import { rank } from '../CommandPalette';

/** Highest-ranked command for a query, out of the ones offered. */
const best = (query: string, commands: string[]): string =>
  [...commands].sort((a, b) => rank(b, query) - rank(a, query))[0];

const ROOT = [
  'Start focus session',
  'Enter Deep Focus',
  'Skip to next interval',
  'Reset timer',
  'Focus on a task…',
  'Switch timer preset…',
  'Dashboard',
  'Tasks',
  'Analytics',
  'Progress',
  'Settings',
  'Change theme…',
  'New task',
];

describe('command palette ranking', () => {
  it('puts the command the query names first', () => {
    // Each of these picked the wrong command under a plain fuzzy scorer.
    expect(best('sett', ROOT)).toBe('Settings');
    expect(best('theme', ROOT)).toBe('Change theme…');
    expect(best('deep', ROOT)).toBe('Enter Deep Focus');
    expect(best('anal', ROOT)).toBe('Analytics');
  });

  it('ranks a literal match above any scattered one', () => {
    // "theme" is a subsequence of neither, but "Change theme…" contains it.
    expect(rank('Change theme…', 'theme')).toBeGreaterThan(rank('Reset timer', 'theme'));
    // "set" starts a word in "Settings" but only sits mid-word in "preset".
    expect(rank('Settings', 'set')).toBeGreaterThan(rank('Switch timer preset…', 'set'));
  });

  it('prefers the shorter command when both match the same way', () => {
    // Both match "task" at a word start; the one that is little else wins.
    expect(rank('Tasks', 'task')).toBeGreaterThan(rank('Focus on a task…', 'task'));
  });

  it('still finds a command from an abbreviation', () => {
    expect(rank('Switch timer preset…', 'swtprst')).toBeGreaterThan(0);
    expect(best('dfoc', ['Reset timer', 'Deep Focus'])).toBe('Deep Focus');
  });

  it('scores nothing when a letter is missing', () => {
    expect(rank('Settings', 'zzz')).toBe(0);
    expect(rank('Reset timer', 'theme')).toBe(0);
  });

  it('matches everything on an empty query, so the full list browses', () => {
    for (const command of ROOT) expect(rank(command, '')).toBe(1);
    expect(rank('Settings', '   ')).toBe(1);
  });
});
