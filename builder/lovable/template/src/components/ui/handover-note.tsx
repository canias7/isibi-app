import { cn } from "@/lib/utils";
/**
 * What the next person needs to know.
 *
 * WRITTEN BY THE PERSON LEAVING, read by the person arriving — a shift change, a
 * reassigned ticket, a holiday cover. Without it the incoming person re-reads
 * the whole history and still misses the thing that was only in somebody's head.
 *
 * IT NAMES BOTH PEOPLE AND THE TIME. A handover note with no author is
 * unattributable advice, and the reader cannot go back and ask.
 *
 * OUTSTANDING ITEMS ARE A LIST, not prose. The specific unfinished things are
 * what get dropped at a handover, and burying them in a paragraph is how.
 */
export function HandoverNote({ from, to, at, note, outstanding, className }: {
  from: string;
  to?: string;
  at?: string;
  note?: React.ReactNode;
  /** The specific things still to do. */
  outstanding?: string[];
  className?: string;
}) {
  return (
    <section aria-label="Handover" className={cn("flex flex-col gap-2 rounded-md border border-border p-3", className)}>
      <p className="text-xs text-muted-foreground">
        Handed over by <span className="font-medium text-foreground">{from}</span>
        {to ? <> to <span className="font-medium text-foreground">{to}</span></> : null}
        {at ? ` · ${at}` : ""}
      </p>
      {note && <div className="text-sm">{note}</div>}
      {outstanding?.length ? (
        <div>
          <p className="text-sm font-medium">Still to do</p>
          <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-muted-foreground">
            {outstanding.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
