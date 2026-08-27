import { Badge } from "@/components/ui/badge";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/**
 * One incident and its updates.
 *
 * Newest update first, each stamped: an incident log read top-down in the
 * order things happened means the current state is at the bottom, which is
 * the one thing anybody opening the page wants.
 */
export function IncidentItem({ title, status = "investigating", updates, startedAt, className }: {
  title: string; status?: "investigating" | "identified" | "monitoring" | "resolved";
  updates?: { at: string | number | Date; body: string; status?: string }[];
  startedAt?: string | number | Date; className?: string;
}) {
  const variant = status === "resolved" ? "secondary" : "outline";
  return (
    <article data-slot="incident-item" className={cn("border-b border-border py-4 last:border-0", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Badge variant={variant} className="capitalize">{status}</Badge>
        {startedAt && <span className="text-xs text-muted-foreground">Started <TimeAgo date={startedAt} /></span>}
      </div>
      {updates?.length ? (
        <ol className="mt-3 space-y-2 border-s border-border ps-4">
          {updates.map((u, i) => (
            <li key={i} className="text-sm">
              <span className="text-xs text-muted-foreground">
                {u.status && <span className="me-2 font-medium capitalize text-foreground">{u.status}</span>}
                <TimeAgo date={u.at} />
              </span>
              <p className="mt-0.5">{u.body}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}
