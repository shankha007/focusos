import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, FileJson, Layers, Replace, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  BACKUP_TABLES,
  BackupError,
  parseBackup,
  restoreBackup,
  tableLabel,
  type ParsedBackup,
  type RestoreMode,
} from '@/lib/backup';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useStatsStore } from '@/store/useStatsStore';
import { usePresetStore } from '@/store/usePresetStore';
import { useTimerStore } from '@/store/useTimerStore';
import { cn, pluralize } from '@/lib/utils';

/** Anything larger is not a backup this app wrote; refuse before parsing. */
const MAX_BYTES = 100 * 1024 * 1024;

export function RestoreDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<ParsedBackup | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setBackup(null);
    setFileName('');
    setError(null);
    setMode('merge');
    setConfirmText('');
    onOpenChange(false);
  };

  const pick = async (file: File) => {
    setError(null);
    setBackup(null);
    setFileName(file.name);

    if (file.size > MAX_BYTES) {
      setError('That file is too large to be a FocusOS backup.');
      return;
    }

    try {
      const parsed = parseBackup(await file.text());
      setBackup(parsed);
      setConfirmText('');
    } catch (err) {
      setError(
        err instanceof BackupError
          ? err.message
          : 'That file could not be read. Pick the JSON file the export button produced.',
      );
    }
  };

  const run = async () => {
    if (!backup) return;
    setBusy(true);
    try {
      const result = await restoreBackup(backup, mode);

      // A running timer points at a session that may no longer exist after a
      // replace, so clear it rather than let it finish into a stale row.
      if (mode === 'replace') {
        useTimerStore.getState().reset();
        localStorage.removeItem('focusos:timer');
      }

      // Every store reads from Dexie at boot; pull them all forward.
      await useSettingsStore.getState().load();
      await Promise.all([
        useTaskStore.getState().load(),
        useStatsStore.getState().refresh(),
        usePresetStore.getState().load(),
      ]);

      toast.success(
        `Restored ${result.total} ${pluralize(result.total, 'record')}.`,
        {
          description: result.settingsRestored
            ? 'Your settings came back with it.'
            : 'Your current settings were left as they are.',
        },
      );
      close();
    } catch {
      toast.error('The restore failed — nothing was changed.', {
        description: 'Your existing data is untouched. Try the file again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const skipped = backup ? Object.entries(backup.skipped) : [];
  const skippedTotal = skipped.reduce((n, [, c]) => n + c, 0);
  const total = backup
    ? BACKUP_TABLES.reduce((n, t) => n + backup.rows[t].length, 0)
    : 0;
  const needsConfirm = mode === 'replace';
  const canRun = Boolean(backup) && !busy && (!needsConfirm || confirmText === 'replace');

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogTitle>Restore from backup</DialogTitle>
        <DialogDescription>
          Pick a JSON file exported from FocusOS. Nothing is written until you confirm.
        </DialogDescription>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so re-picking the same file after a failure still fires.
            e.target.value = '';
            if (file) void pick(file);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left transition-colors hover:border-subtle/50 hover:bg-elevated"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-elevated text-muted">
            <FileJson className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium">
              {fileName || 'Choose a backup file…'}
            </span>
            <span className="block text-[12px] text-muted">
              {fileName ? 'Click to pick a different file.' : 'focusos-backup-YYYY-MM-DD.json'}
            </span>
          </span>
        </button>

        {error && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p className="text-[12px] leading-relaxed text-fg">{error}</p>
          </div>
        )}

        {backup && (
          <>
            <div className="mt-4 rounded-xl border border-border bg-elevated/50 p-3.5">
              <p className="text-[13px] font-medium">
                {total} {pluralize(total, 'record')} in this backup
              </p>
              {backup.exportedAt && (
                <p className="mt-0.5 text-[12px] text-muted">
                  Exported {new Date(backup.exportedAt).toLocaleString()}
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                {BACKUP_TABLES.filter((t) => backup.rows[t].length > 0).map((t) => (
                  <div key={t} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] text-muted">
                      {tableLabel(t, backup.rows[t].length)}
                    </span>
                    <span className="tabular text-[12px] font-medium">
                      {backup.rows[t].length}
                    </span>
                  </div>
                ))}
              </div>

              {skippedTotal > 0 && (
                <p className="mt-3 border-t border-border pt-2.5 text-[12px] leading-relaxed text-warn">
                  {skippedTotal} {pluralize(skippedTotal, 'row')} in the file could not be read and
                  will be skipped ({skipped.map(([t, c]) => `${c} ${tableLabel(t, c)}`).join(', ')}).
                  Everything else restores normally.
                </p>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <ModeOption
                icon={Layers}
                title="Merge"
                description="Adds everything to what's already here. Records that share an id are replaced by the backup's copy. Your current settings stay as they are."
                active={mode === 'merge'}
                onSelect={() => {
                  setMode('merge');
                  setConfirmText('');
                }}
              />
              <ModeOption
                icon={Replace}
                title="Replace"
                description="Wipes this device's data first, then restores the backup exactly — settings included. Use this after clearing site data."
                active={mode === 'replace'}
                danger
                onSelect={() => setMode('replace')}
              />
            </div>

            {needsConfirm && (
              <div className="mt-4">
                <label htmlFor="confirm-restore" className="mb-1.5 block text-[13px] font-medium">
                  Type <span className="font-mono text-danger">replace</span> to confirm
                </label>
                <Input
                  id="confirm-restore"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="replace"
                  autoComplete="off"
                />
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  This deletes every task, session, distraction, and badge currently on this device.
                </p>
              </div>
            )}
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={mode === 'replace' ? 'danger' : 'default'}
            disabled={!canRun}
            onClick={() => void run()}
          >
            <Upload className="h-3.5 w-3.5" />
            {busy ? 'Restoring…' : mode === 'replace' ? 'Replace everything' : 'Merge into my data'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({
  icon: Icon,
  title,
  description,
  active,
  danger,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  active: boolean;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all',
        active
          ? danger
            ? 'border-danger bg-danger/10'
            : 'border-accent bg-accent/10'
          : 'border-border hover:border-subtle/40 hover:bg-elevated',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          active ? (danger ? 'text-danger' : 'text-accent') : 'text-subtle',
        )}
      />
      <span>
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{description}</span>
      </span>
    </button>
  );
}
