import { DateFormat } from "@/components/ui/date-format";
import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * The automatic saves, newest first, each one openable.
 *
 * Different from `snapshot-list` in the one way that matters to the reader:
 * NOBODY CHOSE THESE, so they have no names, and the timestamp is the only
 * handle. That makes the time formatting the whole design — a column of
 * identical dates with the minutes buried is unusable, so the day is shown once
 * per group and the time leads each row.
 *
 * IT SAYS HOW LONG THEY ARE KEPT. Autosaves are rotated, and somebody deciding
 * whether to rely on one instead of copying the text out needs to know it will
 * still be there tomorrow. The caller passes the policy because only the caller
 * knows it; nothing is claimed when it is omitted.
 *
 * Rows are buttons rather than links: restoring an autosave is an action on the
 * current document, not navigation to a different page, and a link would put a
 * meaningless URL in the reader's history.
 */
export function AutosaveHistory({ entries, onOpen, retentionNote, empty = "No autosaves yet.", className }: {
  /** Newest first. */
  entries: { key: string; at: string | number | Date; note?: string }[];
  onOpen: (key: string) => void;
  /** "Kept for 7 days" — omitted claims nothing. */
  retentionNote?: string;
  empty?: string;
  className?: string;
}) {
  if (!entries.length) {
    return <p data-slot="autosave-history" className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  }
  let lastDay = "";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ol className="divide-y divide-border rounded-md border border-border">
        {entries.map((e) => {
          const d = toDate(e.at);
          const day = d.toDateString();
          const newDay = day !== lastDay;
          lastDay = day;
          return (
            <li key={e.key}>
              {newDay && (
                <p className="bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <DateFormat date={e.at} />
                </p>
              )}
              <button type="button" onClick={() => onOpen(e.key)}
                className="flex w-full cursor-pointer items-baseline gap-3 px-3 py-2 text-start text-sm hover:bg-muted">
                <time dateTime={isoAttr(e.at)} className="tabular-nums">
                  {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </time>
                {e.note && <span className="min-w-0 truncate text-muted-foreground">{e.note}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {retentionNote && <p className="text-xs text-muted-foreground">{retentionNote}</p>}
    </div>
  );
}
