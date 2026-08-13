import { cn, toDate } from "@/lib/utils";
/**
 * What the next person needs to know, in the three parts that matter.
 *
 * OUTSTANDING, WATCH-OUT, DONE — in that order, because that is the order of
 * urgency and a handover read at the start of a shift is skimmed. A single free
 * text box gets a wall of prose in which the one urgent item is the fourth
 * sentence of the second paragraph.
 *
 * "NOTHING OUTSTANDING" IS PRINTED, not left blank. An empty section is
 * ambiguous between "nothing to hand over" and "nobody filled this in", and
 * those are opposite situations at 6am.
 *
 * WHO WROTE IT AND WHEN IS PART OF THE DOCUMENT. A handover with no author
 * cannot be queried, and one with no time cannot be told from yesterday's.
 *
 * IT IS READ-ONLY. Composing belongs to `shift-handover`; a summary that is
 * also an editor is one somebody changes while reading it, which for a handover
 * record is exactly wrong.
 */
export function HandoffSummary({ outstanding = [], watch = [], done = [], by, at, className }: {
  /** Things the next person must do. */
  outstanding?: string[];
  /** Things to keep an eye on. */
  watch?: string[];
  /** Completed, for context. */
  done?: string[];
  by?: string;
  /** ISO date-time. */
  at?: string;
  className?: string;
}) {
  const d = at ? toDate(at) : null;
  const ok = d && !Number.isNaN(d.getTime());
  const section = (title: string, items: string[], empty?: string, strong?: boolean) => (
    <div>
      <p className={cn("text-xs font-medium", !strong && "text-muted-foreground")}>{title}</p>
      {items.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{empty ?? "Nothing"}</p>
      ) : (
        <ul className={cn("space-y-0.5 text-sm", !strong && "text-muted-foreground")}>
          {items.map((i) => (
            <li key={i} className="flex gap-2"><span aria-hidden="true">·</span><span>{i}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className={cn("space-y-2.5 rounded-md border border-border p-3", className)}>
      {section("Outstanding", outstanding, "Nothing outstanding", true)}
      {section("Keep an eye on", watch, "Nothing flagged")}
      {done.length > 0 && section("Done this shift", done)}
      {(by || ok) && (
        <p className="border-t border-border pt-2 text-xs text-muted-foreground">
          Handed over by {by ?? "someone"}
          {ok && (
            <> at <time dateTime={d!.toISOString()}>
              {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </time></>
          )}
        </p>
      )}
    </div>
  );
}
