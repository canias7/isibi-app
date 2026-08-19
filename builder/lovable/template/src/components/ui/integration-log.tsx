import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * What each sync run actually did — and what it skipped.
 *
 * SKIPPED RECORDS ARE THE POINT. A run reporting "42 synced" is read as
 * complete, and the eight it silently dropped for a missing field are
 * discovered a month later by somebody reconciling by hand. The skip count sits
 * beside the success count, always.
 *
 * PARTIAL IS A DISTINCT OUTCOME. A run that moved most records and failed on
 * three is neither a success nor a failure, and collapsing it into either is
 * how a persistent data problem gets reported as green.
 *
 * THE FIRST REASON IS ON THE ROW. Skipped records nearly always share one cause
 * — "no email address" — and naming it turns a log entry into a fix, where a
 * bare count is a task for later.
 *
 * NEWEST FIRST, since the question here is whether it is working now, and the
 * three outcomes are words rather than colours because this gets pasted into
 * support conversations.
 */
export type SyncRun = {
  id: string;
  at?: string;
  outcome: "ok" | "partial" | "failed";
  synced?: number;
  skipped?: number;
  /** The commonest reason things were skipped or it failed. */
  reason?: string;
  /** How long it took, in seconds. */
  seconds?: number;
};

const WORD = { ok: "Synced", partial: "Partly synced", failed: "Failed" } as const;

export function IntegrationLog({ runs, emptyNote = "This has never run", className }: {
  /** Newest first. */
  runs: SyncRun[];
  emptyNote?: string;
  className?: string;
}) {
  if (!runs.length) return <p className={cn("text-sm text-muted-foreground", className)}>{emptyNote}</p>;
  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border text-sm", className)}>
      {runs.map((r) => {
        const d = r.at ? toDate(r.at) : null;
        const ok = d && !Number.isNaN(d.getTime());
        return (
          <li key={r.id} className="flex items-start gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className={cn("block", r.outcome !== "ok" && "font-medium")}>
                {WORD[r.outcome]}
                {(r.synced !== undefined || r.skipped !== undefined) && (
                  <span className="font-normal text-muted-foreground">
                    {" · "}
                    {r.synced !== undefined && `${r.synced.toLocaleString()} synced`}
                    {r.skipped !== undefined && r.skipped > 0 && `, ${r.skipped.toLocaleString()} skipped`}
                  </span>
                )}
              </span>
              {r.reason && <span className="block text-xs text-muted-foreground">{r.reason}</span>}
            </span>
            <span className="shrink-0 text-end text-xs text-muted-foreground">
              {ok && (
                <time dateTime={isoAttr(d)} className="block">
                  {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </time>
              )}
              {r.seconds !== undefined && <span className="block tabular-nums">{r.seconds}s</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
