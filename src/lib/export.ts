import type { Distraction, DistractionCategory, Session } from '@/types';
import { exportAll } from '@/db/repositories';
import { dateKey, formatDuration, formatTime } from '@/lib/utils';
import { distractionPatterns, summarize, toDayStats } from '@/engine/analytics';

/** Hands a generated blob to the browser as a file download. */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  // Firefox only dispatches the download for an anchor that is in the document.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking in the same task can cancel the download before the browser has
  // finished reading the blob, so let the current task drain first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Renders one value as a CSV cell: escaped per RFC 4180 and neutralised so spreadsheets can't execute it as a formula. */
function csvCell(value: unknown): string {
  // Numbers can never carry an injection payload, and guarding them would
  // mangle negatives.
  if (typeof value === 'number') return String(value);

  // Anything that is not already text has no meaningful cell representation —
  // `String({})` writes "[object Object]" into the spreadsheet, which reads as
  // data the user never entered. An empty cell is the honest rendering.
  const s = typeof value === 'string' ? value : typeof value === 'boolean' ? String(value) : '';
  // Spreadsheets evaluate any cell that opens with one of these, so a task
  // titled `=HYPERLINK(...)` would run on open. A leading apostrophe pins the
  // cell to text without changing what the reader sees.
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  // Escape by RFC 4180: wrap in quotes, double any internal quotes.
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Downloads the given sessions as a spreadsheet-ready CSV, one row per session. */
export function exportSessionsCsv(sessions: Session[]): void {
  const headers = [
    'date',
    'start_time',
    'end_time',
    'type',
    'task',
    'planned_minutes',
    'actual_minutes',
    'completed',
    'mood_before',
    'energy_before',
    'productivity_after',
    'distractions',
    'accomplishment',
  ];

  const rows = sessions.map((s) => [
    dateKey(s.startedAt),
    formatTime(s.startedAt),
    formatTime(s.endedAt),
    s.type,
    s.taskTitle ?? '',
    Math.round(s.plannedMs / 60000),
    Math.round(s.actualMs / 60000),
    s.completed ? 'yes' : 'no',
    s.moodBefore ?? '',
    s.energyBefore ?? '',
    s.productivityAfter ?? '',
    s.distractionCount,
    s.accomplishment ?? '',
  ]);

  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `focusos-sessions-${dateKey()}.csv`);
}

/** Downloads a complete backup of every table as JSON — the file `parseBackup` reads back in. */
export async function exportJson(): Promise<void> {
  const data = await exportAll();
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    `focusos-backup-${dateKey()}.json`,
  );
}

/**
 * jsPDF and its dependencies are ~1.5 MB — far too much to load on boot for a
 * button most users press rarely. Pulled in on demand instead.
 */
export async function exportPdf(
  sessions: Session[],
  distractions: Distraction[],
  distractionCategories: DistractionCategory[],
  periodLabel: string,
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const summary = summarize(sessions, distractions);
  const stats = toDayStats(sessions, distractions);
  const patterns = distractionPatterns(distractions, distractionCategories);

  doc.setFontSize(20);
  doc.text('FocusOS — Focus Report', 40, 50);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${periodLabel} · generated ${new Date().toLocaleDateString()}`, 40, 68);

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text('Summary', 40, 100);

  autoTable(doc, {
    startY: 112,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    body: [
      ['Total focus time', formatDuration(summary.focusMs)],
      ['Sessions completed', String(summary.sessions)],
      ['Completion rate', `${Math.round(summary.completionRate * 100)}%`],
      ['Average session', formatDuration(summary.avgSessionMs)],
      [
        'Average productivity',
        summary.avgProductivity ? `${summary.avgProductivity.toFixed(1)} / 5` : 'Not rated',
      ],
      ['Distractions logged', String(summary.distractions)],
      ['Active days', String(summary.activeDays)],
      [
        'Best day',
        summary.bestDay ? `${summary.bestDay.date} (${formatDuration(summary.bestDay.focusMs)})` : '—',
      ],
    ],
  });

  const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.text('Daily breakdown', 40, afterSummary + 28);

  autoTable(doc, {
    startY: afterSummary + 38,
    head: [['Date', 'Focus time', 'Sessions', 'Distractions', 'Avg productivity']],
    body: [...stats.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => [
        d.date,
        formatDuration(d.focusMs),
        String(d.sessions),
        String(d.distractions),
        d.avgProductivity ? d.avgProductivity.toFixed(1) : '—',
      ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [120, 134, 255] },
  });

  if (patterns.length > 0) {
    const afterDaily = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.text('Distraction patterns', 40, afterDaily + 28);

    autoTable(doc, {
      startY: afterDaily + 38,
      head: [['Source', 'Count', 'Share', 'Typical point in session']],
      body: patterns.map((p) => [
        p.label,
        String(p.count),
        `${Math.round(p.share * 100)}%`,
        p.avgProgress !== null ? `${Math.round(p.avgProgress * 100)}% in` : '—',
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [245, 165, 36] },
    });
  }

  doc.save(`focusos-report-${dateKey()}.pdf`);
}
