import { cn, toDate } from "@/lib/utils";
/**
 * Everything that happened to a request, oldest first.
 *
 * OLDEST FIRST, UNLIKE ALMOST EVERY OTHER FEED IN THIS KIT. An approval trail
 * is read as a story — submitted, changed, approved, recalled — and newest-first
 * makes somebody reconstruct the order backwards. Activity feeds are for
 * catching up; this is for understanding how a thing got where it is.
 *
 * A RESUBMISSION RESETS THE APPROVALS, and the trail is the only place that is
 * visible. Without it, an approver sees two ticks and no indication that both
 * predate the version in front of them — which is how a changed request gets
 * waved through on old signatures.
 *
 * THE ACTOR IS ALWAYS NAMED. "Approved" with no name is the state, not the
 * history, and a trail whose entries have no author cannot answer the question
 * anybody brings to it.
 *
 * `<ol>` because the order carries meaning, and a real `<time>` per entry.
 */
export type ApprovalEvent = {
  id: string;
  action: string;
  by: string;
  at?: string;
  note?: string;
  /** Marks a point where earlier approvals stopped counting. */
  resets?: boolean;
};

export function ApprovalHistory({ events, className }: {
  /** Oldest first. */
  events: ApprovalEvent[];
  className?: string;
}) {
  if (!events.length) return null;
  return (
    <ol className={cn("space-y-0", className)}>
      {events.map((e, i) => {
        const d = e.at ? toDate(e.at) : null;
        const ok = d && !Number.isNaN(d.getTime());
        return (
          <li key={e.id} className="flex gap-3">
            <span className="flex flex-col items-center" aria-hidden="true">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full",
                e.resets ? "bg-foreground" : "border border-foreground bg-background")} />
              {i < events.length - 1 && <span className="w-px flex-1 bg-border" />}
            </span>
            <span className={cn("min-w-0 pb-4 text-sm", i === events.length - 1 && "pb-0")}>
              <span className="block">
                <span className={cn(e.resets && "font-medium")}>{e.action}</span>
                <span className="text-muted-foreground"> · {e.by}</span>
              </span>
              {ok && (
                <time dateTime={d!.toISOString()} className="block text-xs text-muted-foreground">
                  {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </time>
              )}
              {e.note && <span className="mt-0.5 block text-xs">{e.note}</span>}
              {e.resets && <span className="mt-0.5 block text-xs text-muted-foreground">Earlier approvals no longer count.</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
