import { cn } from "@/lib/utils";
/**
 * What a restore would change, before it is run.
 *
 * IT COUNTS WHAT WILL BE LOST, not just what will come back. A restore
 * overwrites everything created since the backup, and "restore from 2 August"
 * hides that eleven bookings taken this morning disappear — which is the fact
 * that makes somebody choose a different backup or export first.
 *
 * THREE NUMBERS: restored, overwritten, lost. They answer different questions
 * and every restore dialog collapses them into one reassuring sentence about
 * recovery.
 *
 * IT NAMES THE WINDOW BEING UNDONE in plain time. "You will lose everything
 * since 06:00 yesterday — about 30 hours of work" is what somebody weighs, and
 * the timestamp alone requires arithmetic under pressure.
 *
 * IT IS PURELY A PREVIEW. Running it belongs to `restore-confirm`, so nobody
 * arrives at a screen that both explains and executes — the reading and the
 * deciding are separate acts.
 */
export function RestorePreview({ fromLabel, undoes, restored, overwritten, lost, notes = [], className }: {
  /** Which backup — "2 August, 06:00". */
  fromLabel: string;
  /** How much work is undone — "about 30 hours". */
  undoes?: string;
  /** Records that come back. */
  restored?: number;
  /** Existing records replaced by older versions. */
  overwritten?: number;
  /** Records created since the backup that disappear. */
  lost?: number;
  notes?: string[];
  className?: string;
}) {
  return (
    <div data-slot="restore-preview" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        Restoring from <span className="font-medium">{fromLabel}</span>
        {undoes && <span className="block text-xs text-muted-foreground">This undoes {undoes} of work.</span>}
      </p>
      <dl className="space-y-0.5 text-sm">
        {restored !== undefined && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Brought back</dt>
            <dd className="tabular-nums">{restored.toLocaleString()}</dd>
          </div>
        )}
        {overwritten !== undefined && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Replaced with older versions</dt>
            <dd className="tabular-nums">{overwritten.toLocaleString()}</dd>
          </div>
        )}
        {lost !== undefined && (
          <div className="flex justify-between gap-3 font-medium">
            <dt>Created since — these disappear</dt>
            <dd className="tabular-nums">{lost.toLocaleString()}</dd>
          </div>
        )}
      </dl>
      {notes.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {notes.map((n) => (
            <li key={n} className="flex gap-2"><span aria-hidden="true">·</span><span>{n}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
