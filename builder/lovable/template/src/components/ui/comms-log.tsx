import { cn } from "@/lib/utils";
/**
 * What was said and when — the record an inquiry reads.
 *
 * DECISIONS ARE MARKED SEPARATELY FROM MESSAGES. An incident log is mostly
 * traffic, and the four or five moments where somebody decided something are what
 * anybody reads it for afterwards. Marking them at the time costs nothing and
 * finding them later is otherwise an afternoon.
 *
 * ENTRIES ARE APPEND-ONLY AND A CORRECTION IS A NEW ENTRY. A log that can be
 * edited is not a record, and the temptation to tidy it is strongest exactly when
 * it matters most. The component renders corrections as their own lines, pointing
 * back.
 *
 * THE TIME IS ON EVERY LINE AND IS NEVER RELATIVE. "12 minutes ago" is unusable
 * in a document read a year later, and an incident log is written to be read a
 * year later.
 *
 * WHO SAID IT AND OVER WHAT. A decision recorded from a radio call somebody
 * half-heard is different evidence from one typed by the person who made it.
 */
export type LogEntry = {
  id: string;
  at: string;
  who?: string;
  /** Radio, telephone, in person. */
  over?: string;
  text: string;
  decision?: boolean;
  /** Points at the entry this corrects. */
  corrects?: string;
};

export function CommsLog({ entries, decisionsOnly, className }: {
  entries: LogEntry[];
  decisionsOnly?: boolean;
  className?: string;
}) {
  const shown = decisionsOnly ? entries.filter((e) => e.decision) : entries;
  const decisions = entries.filter((e) => e.decision).length;
  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      <p className="text-xs tabular-nums text-muted-foreground">
        {entries.length} {entries.length === 1 ? "entry" : "entries"}, {decisions}{" "}
        {decisions === 1 ? "decision" : "decisions"}.
      </p>
      <ol className="divide-y divide-border rounded-md border border-border">
        {shown.map((e) => (
          <li key={e.id} className="flex gap-3 px-3 py-1.5">
            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{e.at}</span>
            <span className="min-w-0 flex-1">
              <span className={cn(e.decision && "font-medium")}>{e.text}</span>
              <span className="block text-xs text-muted-foreground">
                {[e.decision && "Decision", e.who, e.over, e.corrects && `corrects the ${e.corrects} entry`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        Nothing here can be edited. A correction is a new entry pointing at the old one.
      </p>
    </div>
  );
}
