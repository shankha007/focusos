import type { Distraction, DistractionCategory, Rating, Session, Task } from '@/types';
import { MINUTE, formatDuration, mean, pluralize } from '@/lib/utils';
import { distractionPatterns, focusOnly, focusTimeMs } from './analytics';
import { fmtHour } from './adaptive';

export interface Reflection {
  headline: string;
  summary: string;
  accomplishments: string[];
  bestWindow: string | null;
  distractionNote: string | null;
  recommendations: string[];
  /** 'quiet' when there's simply nothing to reflect on yet. */
  tone: 'quiet' | 'building' | 'strong' | 'exceptional';
}

/**
 * A written daily debrief assembled from rules rather than a language model, so
 * it works offline and never invents a fact. Every sentence traces back to a
 * number in the session log.
 */
export function generateReflection(
  sessions: Session[],
  distractions: Distraction[],
  distractionCategories: DistractionCategory[],
  tasks: Task[],
  dailyGoalSessions: number,
): Reflection {
  const focus = focusOnly(sessions);
  const completed = focus.filter((s) => s.completed);
  const totalMs = focusTimeMs(sessions);

  if (completed.length === 0) {
    return {
      headline: 'No sessions logged yet today',
      summary:
        'Nothing to report so far. A single focus session is enough to get the day on the board — starting is usually the hardest part.',
      accomplishments: [],
      bestWindow: null,
      distractionNote: null,
      recommendations: [
        'Pick the one task that would make today feel worthwhile, and start a single session on it.',
      ],
      tone: 'quiet',
    };
  }

  const goalPct = completed.length / Math.max(1, dailyGoalSessions);
  const tone: Reflection['tone'] =
    goalPct >= 1.25 ? 'exceptional' : goalPct >= 0.85 ? 'strong' : 'building';

  /* Headline */
  const headline =
    tone === 'exceptional'
      ? `Outstanding day — ${completed.length} sessions, ${formatDuration(totalMs)} focused`
      : tone === 'strong'
        ? `Solid day — ${formatDuration(totalMs)} of focused work`
        : `${completed.length} ${pluralize(completed.length, 'session')} in, ${formatDuration(totalMs)} focused`;

  /* Best window — the hour with the most focus time */
  const hourMs = new Map<number, number>();
  for (const s of completed) {
    const h = new Date(s.startedAt).getHours();
    hourMs.set(h, (hourMs.get(h) ?? 0) + s.actualMs);
  }
  const bestHour = [...hourMs.entries()].sort((a, b) => b[1] - a[1])[0];
  const bestWindow = bestHour
    ? `${fmtHour(bestHour[0])}–${fmtHour(bestHour[0] + 1)} was your deepest stretch, with ${formatDuration(bestHour[1])} of focus.`
    : null;

  /* Accomplishments — prefer what the user wrote, fall back to task progress */
  const written = completed
    .map((s) => s.accomplishment?.trim())
    .filter((v): v is string => !!v && v.length > 0);

  const taskCounts = new Map<string, number>();
  for (const s of completed) {
    if (s.taskTitle) taskCounts.set(s.taskTitle, (taskCounts.get(s.taskTitle) ?? 0) + 1);
  }
  const taskLines = [...taskCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([title, n]) => `${title} — ${n} ${pluralize(n, 'session')}`);

  const finishedToday = tasks.filter(
    (t) => t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString(),
  );
  const finishedLines = finishedToday.map((t) => `Finished: ${t.title}`);

  const accomplishments = [...finishedLines, ...written, ...taskLines].slice(0, 6);

  /* Distractions */
  const patterns = distractionPatterns(distractions, distractionCategories);
  let distractionNote: string | null = null;
  if (patterns.length > 0) {
    const top = patterns[0];
    const whenText =
      top.avgProgress !== null
        ? ` It tends to hit around ${Math.round(top.avgProgress * 100)}% into a session.`
        : '';
    distractionNote = `${top.label} pulled you away ${top.count} ${pluralize(top.count, 'time')} — ${Math.round(top.share * 100)}% of today's interruptions.${whenText}`;
  } else {
    distractionNote = 'You logged no distractions today. That is a genuinely rare kind of day.';
  }

  /* Summary paragraph */
  const avgProd = mean(
    completed.map((s) => s.productivityAfter).filter((v): v is Rating => typeof v === 'number'),
  );
  const completionRate = focus.length > 0 ? completed.length / focus.length : 1;

  const parts: string[] = [];
  parts.push(
    `You completed ${completed.length} of ${focus.length} ${pluralize(focus.length, 'session')} you started, and focused for ${formatDuration(totalMs)} in total.`,
  );
  if (goalPct >= 1) {
    parts.push(`That clears your goal of ${dailyGoalSessions} sessions.`);
  } else {
    const short = dailyGoalSessions - completed.length;
    parts.push(`That is ${short} ${pluralize(short, 'session')} short of your daily goal.`);
  }
  if (avgProd !== null) {
    parts.push(
      avgProd >= 4
        ? `You rated these sessions ${avgProd.toFixed(1)}/5 — you were in a good groove.`
        : avgProd >= 3
          ? `You rated these sessions ${avgProd.toFixed(1)}/5, which is steady if unspectacular.`
          : `You rated these sessions ${avgProd.toFixed(1)}/5, so the work felt like a grind today.`,
    );
  }

  /* Recommendations */
  const recommendations: string[] = [];

  if (completionRate < 0.7) {
    const avgPlanned = mean(focus.map((s) => s.plannedMs))!;
    recommendations.push(
      `You abandoned ${Math.round((1 - completionRate) * 100)}% of sessions today. Try dropping to ${Math.max(15, Math.round(avgPlanned / MINUTE) - 10)} minutes — a shorter session you finish beats a long one you don't.`,
    );
  }

  if (patterns.length > 0 && patterns[0].count >= 3) {
    const top = patterns[0];
    recommendations.push(
      top.categoryId === 'd-phone'
        ? 'Your phone was the main leak today. Leave it in another room for your first session tomorrow.'
        : `Plan around ${top.label.toLowerCase()} tomorrow — it was your most common interruption.`,
    );
  }

  if (bestHour) {
    recommendations.push(
      `Schedule tomorrow's hardest task at ${fmtHour(bestHour[0])} — that is when you focused best today.`,
    );
  }

  if (avgProd !== null && avgProd < 3) {
    recommendations.push(
      'Productivity ratings were low. Consider whether the task was poorly defined — vague work is hard to focus on.',
    );
  }

  if (goalPct >= 1.5) {
    recommendations.push(
      'You went well past your goal today. Watch that this does not borrow from tomorrow — sustainable beats heroic.',
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Keep the same shape tomorrow. This pattern is working.');
  }

  return {
    headline,
    summary: parts.join(' '),
    accomplishments,
    bestWindow,
    distractionNote,
    recommendations: recommendations.slice(0, 4),
    tone,
  };
}
