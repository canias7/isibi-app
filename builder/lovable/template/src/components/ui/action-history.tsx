import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * What happened to this record, in order, with who did it.
 *
 * Distinct from `undo-stack`, which is your own last few actions and can be
 * reversed. This is the permanent record across everybody, and nothing here is
 * a button — an audit trail with controls in it is a thing people expect to be
 * able to edit.
 *
 * WHO IS AS IMPORTANT AS WHAT, and the component makes it required rather than
 * optional for exactly that reason. "Price changed to £48" is a fact; "Sam
 * changed the price to £48 on Tuesday" is the answer to the question anybody
 * opening this panel actually has.
 *
 * Newest first, and each time is a real `<time datetime>` — a history panel is
 * the surface most likely to be read months later, in another timezone, by
 * somebody reconstructing what went wrong.
 */
export type HistoryEntry = { key: string; what: string; by: string; at: string | number | Date; detail?: string };

export function ActionHistory({ entries, empty = "Nothing has happened yet.", className }: {
  /** Newest first. */
  entries: HistoryEntry[];
  empty?: string;
  className?: string;
}) {
  if (!entries.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  }
  return (
    <ol className={cn("flex flex-col", className)}>
      {entries.map((e, i) => (
        <li key={e.key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground" />
            {i < entries.length - 1 && <span aria-hidden className="w-px flex-1 bg-border" />}
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <p className="text-sm">
              <span className="font-medium">{e.by}</span> {e.what}
            </p>
            {e.detail && <p className="text-sm text-muted-foreground">{e.detail}</p>}
            <p className="text-xs text-muted-foreground">
              <time dateTime={new Date(e.at).toISOString()}><DateFormat date={e.at} withTime /></time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
