import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * Every time a rule ran, and whether it did anything.
 *
 * "RAN AND MATCHED NOTHING" IS AN ENTRY, not an absence. A log that only
 * records actions cannot distinguish a rule that is working quietly from one
 * that is switched off, broken, or never being triggered — and those look
 * identical from the outside, which is why a silently dead automation can go
 * unnoticed for months.
 *
 * FAILURES CARRY THEIR REASON ON THE ROW. An automation fails against something
 * external — a mail server, a full inbox, a deleted record — and the reason is
 * the only actionable part. Hiding it behind a click means nobody looks.
 *
 * NEWEST FIRST, because the question here is "is it working now?". This is the
 * opposite choice from `approval-history` and for the opposite reason.
 *
 * THE THREE OUTCOMES ARE WORDS, not coloured dots — this is a table people
 * screenshot into a support conversation, where colour is the first casualty.
 */
export type RuleRun = {
  id: string;
  at?: string;
  outcome: "acted" | "skipped" | "failed";
  /** What it did, or why it did not. */
  detail?: string;
  /** The record it ran against. */
  subject?: string;
};

const WORD = { acted: "Acted", skipped: "No match", failed: "Failed" } as const;

export function RuleLog({ runs, emptyNote = "This rule has not run yet", className }: {
  /** Newest first. */
  runs: RuleRun[];
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
              <span className={cn("block", r.outcome !== "skipped" ? "font-medium" : "text-muted-foreground")}>
                {WORD[r.outcome]}
                {r.subject && <span className="font-normal text-muted-foreground"> · {r.subject}</span>}
              </span>
              {r.detail && <span className="block text-xs text-muted-foreground">{r.detail}</span>}
            </span>
            {ok && (
              <time dateTime={isoAttr(d)} className="shrink-0 text-xs text-muted-foreground">
                {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </time>
            )}
          </li>
        );
      })}
    </ul>
  );
}
