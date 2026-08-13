import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * The last step before a restore, with a backup of the present taken first.
 *
 * IT OFFERS TO BACK UP WHAT IS ABOUT TO BE REPLACED, ticked by default. A
 * restore is an irreversible act aimed at recovering from an irreversible act,
 * and taking a snapshot of the current state first converts it into something
 * survivable. Nobody thinks of this at the moment they need it.
 *
 * THE DATE IS TYPED, NOT A CHECKBOX. Restoring the wrong backup is the specific
 * mistake here — the list is a column of near-identical timestamps — and typing
 * the one you mean is the only confirmation that proves which.
 *
 * THE LOSS IS RESTATED AT THE POINT OF ACTION. Somebody may have read
 * `restore-preview` five minutes and one distraction ago, and the number of
 * records that will disappear is the thing to have in mind while pressing the
 * button.
 *
 * DOWNTIME IS STATED where there is any, since a restore usually takes the
 * system offline and doing that at 2pm on a Friday is a different decision from
 * doing it at midnight.
 */
export function RestoreConfirm({ fromLabel, confirmText, lost, downtime, onRestore, onCancel, busy, className }: {
  /** Which backup — "2 August, 06:00". */
  fromLabel: string;
  /** What must be typed. Defaults to the backup label. */
  confirmText?: string;
  /** Records that will disappear. */
  lost?: number;
  /** Free text — "about 10 minutes, during which nobody can use it". */
  downtime?: string;
  onRestore: (v: { snapshotFirst: boolean }) => void;
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [typed, setTyped] = useState("");
  const [snapshot, setSnapshot] = useState(true);
  const want = confirmText ?? fromLabel;
  const ready = typed.trim().toLowerCase() === want.trim().toLowerCase();
  return (
    <form className={cn("space-y-3 rounded-md border border-foreground/40 bg-muted/40 p-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (ready) onRestore({ snapshotFirst: snapshot }); }}>
      <p className="text-sm font-medium">Restore from {fromLabel}</p>
      {lost !== undefined && lost > 0 && (
        <p className="text-sm">
          <span className="font-medium tabular-nums">{lost.toLocaleString()}</span>{" "}
          {lost === 1 ? "record created since then disappears" : "records created since then disappear"}.
        </p>
      )}
      {downtime && <p className="text-xs text-muted-foreground">This takes {downtime}.</p>}
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5" checked={snapshot} onCheckedChange={(v) => setSnapshot(v === true)} />
        <span>
          Back up what is here now first
          <span className="block text-xs text-muted-foreground">So this restore can itself be undone.</span>
        </span>
      </label>
      <div className="space-y-1">
        <label htmlFor={uid + "-rc-confirm"} className="block text-sm">
          Type <span className="font-medium">{want}</span> to confirm
        </label>
        <input id={uid + "-rc-confirm"} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!ready || busy}>{busy ? "Restoring…" : "Restore"}</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </form>
  );
}
