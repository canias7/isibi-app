import { cn } from "@/lib/utils";
/**
 * A price that is not final, with what could change it.
 *
 * WHAT COULD CHANGE IT IS THE WHOLE COMPONENT. "From £120" tells somebody
 * nothing about their own job; "£120 to £180 — more if the panel needs
 * replacing" lets them decide whether to proceed. The list of variables is what
 * turns a number into a quote somebody can act on.
 *
 * A RANGE, NOT A SINGLE FIGURE WITH AN ASTERISK. People anchor on whatever
 * number they see first, so a "from" price followed by a bill 50% higher feels
 * like a bait — where a range quoted up front and a bill at the top of it does
 * not.
 *
 * IT SAYS WHEN THE PRICE BECOMES FIRM. "Fixed once we have seen it" is the fact
 * that makes an estimate acceptable, and its absence is why estimates are
 * distrusted.
 *
 * VALUES ARE PRE-FORMATTED, so currency stays with the caller's `money` helper
 * — the same rule `range-text` follows, which this composes.
 */
export function CostEstimateNote({ from, to, dependsOn = [], firmWhen, note, className }: {
  /** Pre-formatted. */
  from: string;
  /** Pre-formatted. Omit for an open top end. */
  to?: string;
  /** What could move it — "if the panel needs replacing". */
  dependsOn?: string[];
  /** When it stops being an estimate — "once we have seen it". */
  firmWhen?: string;
  note?: string;
  className?: string;
}) {
  return (
    <div data-slot="cost-estimate-note" className={cn("space-y-1", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">
          {to && to !== from ? `${from}–${to}` : `${from} or so`}
        </span>
        <span className="text-muted-foreground"> · an estimate, not a fixed price</span>
      </p>
      {dependsOn.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {dependsOn.map((d) => (
            <li key={d} className="flex gap-2"><span aria-hidden="true">·</span><span>{d}</span></li>
          ))}
        </ul>
      )}
      {firmWhen && <p className="text-xs text-muted-foreground">The price is fixed {firmWhen}.</p>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
