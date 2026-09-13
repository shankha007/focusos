import { describe, expect, it } from 'vitest';
import { distractionsCsv } from '../export';
import type { Distraction, DistractionCategory } from '@/types';
import { makeSession } from '@/test/helpers';

const CATEGORIES: DistractionCategory[] = [
  { id: 'd-phone', label: 'Phone', icon: 'Smartphone', color: '#f5a524', builtIn: true },
  { id: 'd-email', label: 'Email / chat', icon: 'Mail', color: '#c084fc', builtIn: true },
];

const T0 = new Date(2026, 8, 7, 14, 30).getTime();
const SESSIONS = [makeSession({ id: 'ses_1', startedAt: T0 - 600_000, taskTitle: 'Write the report' })];

const distraction = (over: Partial<Distraction> & { id: string }): Distraction => ({
  categoryId: 'd-phone',
  at: T0,
  ...over,
});

const parse = (csv: string) => csv.split('\n').map((line) => line);

describe('distractionsCsv', () => {
  it('has a header row naming every column', () => {
    expect(parse(distractionsCsv([], CATEGORIES, SESSIONS))[0]).toBe(
      'date,time,category,note,task,percent_into_session,parked,kept_as_task',
    );
  });

  it('writes one row per distraction, oldest first, with what it interrupted', () => {
    const csv = distractionsCsv(
      [
        distraction({ id: 'b', at: T0 + 120_000, categoryId: 'd-email', note: 'Reply to Sam', sessionId: 'ses_1', sessionProgress: 0.62, parked: true, parkedTaskId: 'task_9' }),
        distraction({ id: 'a', at: T0, sessionId: 'ses_1', sessionProgress: 0.4 }),
      ],
      CATEGORIES,
      SESSIONS,
    );
    const [, first, second] = parse(csv);

    expect(first.startsWith('2026-09-07,')).toBe(true);
    expect(first).toContain(',Phone,,Write the report,40,no,no');
    expect(second).toContain(',Email / chat,Reply to Sam,Write the report,62,yes,yes');
  });

  it('names an unknown category rather than leaving the column blank', () => {
    const [, row] = parse(distractionsCsv([distraction({ id: 'x', categoryId: 'd-deleted' })], CATEGORIES, SESSIONS));
    expect(row).toContain(',Other,');
  });

  it('neutralises a note that a spreadsheet would run as a formula', () => {
    // Notes are free text typed mid-session.
    const [, row] = parse(
      distractionsCsv([distraction({ id: 'f', note: '=HYPERLINK("http://example.com")' })], CATEGORIES, SESSIONS),
    );
    expect(row).toContain(`"'=HYPERLINK(""http://example.com"")"`);
  });

  it('quotes a note containing a comma, so the columns stay aligned', () => {
    const [, row] = parse(distractionsCsv([distraction({ id: 'c', note: 'Coffee, then email' })], CATEGORIES, SESSIONS));
    expect(row).toContain('"Coffee, then email"');
  });
});
