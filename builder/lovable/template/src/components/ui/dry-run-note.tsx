import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "Nothing has been saved yet."
 *
 * The sentence that has to be on screen before somebody presses the button
 * that does. Every import, migration and bulk edit has this moment, and the
 * page that omits it is the one where people commit by accident and then ask
 * how to undo it.
 *
 * The commit button says what it will DO — "Import 412 contacts" — rather
 * than "Confirm". A button labelled with its consequence is read; one
 * labelled "Confirm" is pressed.
 */
export function DryRunNote({ actionLabel, onCommit, onCancel, busy, note, className }: {
  actionLabel: string; onCommit: () => void; onCancel?: () => void;
  busy?: boolean; note?: string; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5", className)}>
      <p className="text-sm">
        <strong className="font-medium">Nothing has been saved yet.</strong>
        {note && <span className="ml-1.5 text-muted-foreground">{note}</span>}
      </p>
      <div className="flex gap-2">
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Start over</Button>}
        <Button size="sm" onClick={onCommit} disabled={busy}>{busy ? "Working…" : actionLabel}</Button>
      </div>
    </div>
  );
}
