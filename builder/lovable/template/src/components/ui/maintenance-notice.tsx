import { Wrench } from "lucide-react";
import { cn, toDate } from "@/lib/utils";
/**
 * Planned downtime, with the window in the reader's own timezone.
 *
 * `toLocaleString` and not a preformatted string from the server: a
 * maintenance window announced in someone else's timezone is a window nobody
 * reads correctly.
 */
export function MaintenanceNotice({ start, end, body, className }: {
  start: string | number | Date; end?: string | number | Date | null;
  body?: string; className?: string;
}) {
  const s = toDate(start), e = end ? toDate(end) : null;
  if (Number.isNaN(s.getTime())) return null;
  const fmt = (d: Date) => d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <div data-slot="maintenance-notice" className={cn("flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5", className)}>
      <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="text-sm">
        <p className="font-medium">
          Scheduled maintenance {fmt(s)}{e && !Number.isNaN(e.getTime()) ? ` – ${fmt(e)}` : ""}
        </p>
        {body && <p className="mt-0.5 text-muted-foreground">{body}</p>}
      </div>
    </div>
  );
}
