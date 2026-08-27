import { Button } from "@/components/ui/button";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * One saved state, offered on its own.
 *
 * The single-item sibling of `snapshot-list` — the banner that appears at the
 * top of a page after something went wrong, offering the one obvious place to
 * go back to. A list is the wrong shape for that moment: it asks somebody who
 * is already unsettled to make a comparison, when there is only one sensible
 * answer.
 *
 * IT SAYS WHAT WILL BE LOST, which is the whole difference between this and a
 * plain button. "Restoring will discard the 4 changes since then" is the fact
 * somebody needs, and it is the one a bare "Restore" hides. Omitted when the
 * caller cannot count it, rather than guessed at.
 *
 * Not a dialog. A restore point offered inline can be ignored by scrolling
 * past, and a modal for something that is merely available demands an answer
 * to a question nobody asked.
 */
export function RestorePoint({ label, at, willLose, onRestore, onDismiss, className }: {
  label: string;
  at: string | number | Date;
  /** What restoring costs — "the 4 changes since then". */
  willLose?: string;
  onRestore: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <section data-slot="restore-point" aria-label="Restore point"
      className={cn("flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4", className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          Saved <DateFormat date={at} withTime />
          {willLose ? ` · Restoring discards ${willLose}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={onRestore}>Restore</Button>
        {onDismiss && <Button size="sm" variant="outline" onClick={onDismiss}>Not now</Button>}
      </div>
    </section>
  );
}
