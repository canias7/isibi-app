import { DateFormat } from "@/components/ui/date-format";
import { cn, toDate } from "@/lib/utils";
/**
 * What has been exported, by whom, and whether the link still works.
 *
 * AN EXPORT IS A COPY OF YOUR DATA LEAVING THE SYSTEM, and a list of who made
 * one and when is the only record of that. For anything with personal data it is
 * also the first thing asked for after an incident.
 *
 * EXPIRED LINKS ARE MARKED, NOT REMOVED. The record of the export matters even
 * when the file has gone — deleting the row deletes the audit trail, which is
 * the opposite of what this is for.
 *
 * THE SCOPE IS RECORDED with each entry, because "Sam exported everything" and
 * "Sam exported March" are very different facts.
 */
export function ExportHistory({ exports, empty = "Nothing has been exported.", className }: {
  exports: { key: string; by: string; at: string | number | Date; scope?: string; rows?: number; href?: string; expired?: boolean }[];
  empty?: string;
  className?: string;
}) {
  if (!exports.length) {
    return <p data-slot="export-history" className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  }
  return (
    <ul className={cn("divide-y divide-border text-sm", className)}>
      {exports.map((e) => (
        <li key={e.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
          <span className="min-w-0">
            <span className="font-medium">{e.by}</span>
            <span className="text-muted-foreground">
              {e.scope ? ` — ${e.scope}` : ""}
              {typeof e.rows === "number" ? ` · ${e.rows.toLocaleString()} rows` : ""}
            </span>
            <span className="block text-xs text-muted-foreground">
              <DateFormat date={e.at} withTime />
            </span>
          </span>
          <span className="shrink-0 text-xs">
            {e.expired || !e.href
              ? <span className="text-muted-foreground">link expired</span>
              : <a href={e.href} download className="underline underline-offset-2">Download</a>}
          </span>
        </li>
      ))}
    </ul>
  );
}
