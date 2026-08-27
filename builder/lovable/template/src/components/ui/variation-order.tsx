import { cn } from "@/lib/utils";
/**
 * A change to the contracted work — cost, time, and whether it is agreed.
 *
 * TIME AND MONEY ARE SEPARATE AND BOTH ARE ASKED FOR. A variation priced at
 * £4,000 with no extension of time is one where the contractor absorbs the
 * programme impact — which is a large hidden concession, and every variation
 * form that has only a cost field extracts it silently.
 *
 * INSTRUCTED-BUT-NOT-AGREED IS THE STATE THAT COSTS MONEY. Work is very often
 * begun on a verbal instruction with the price argued afterwards, and that is
 * the position with the worst leverage. Naming it makes the exposure countable.
 *
 * WHO INSTRUCTED IT IS RECORDED. A variation with no named instructor is one
 * the client disputes, and "somebody on site said so" is not a position.
 *
 * THE STATUS DRIVES THE EMPHASIS: an agreed variation is ordinary bookkeeping,
 * an instructed-not-agreed one is a risk that should look like one.
 */
export function VariationOrder({ reference, description, cost, days, state, instructedBy, date, className }: {
  reference?: string;
  description: string;
  /** Pre-formatted. Negative changes are the caller's to format. */
  cost?: string;
  /** Extra days to the programme. */
  days?: number;
  state: "proposed" | "instructed" | "agreed" | "rejected";
  instructedBy?: string;
  /** Free text. */
  date?: string;
  className?: string;
}) {
  const WORD = {
    proposed: "Proposed",
    instructed: "Instructed, not agreed",
    agreed: "Agreed",
    rejected: "Rejected",
  } as const;
  const risky = state === "instructed";
  return (
    <li data-slot="variation-order" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        {reference && <code className="font-mono text-xs text-muted-foreground">{reference}</code>}
        <span className="min-w-0 flex-1">{description}</span>
        {cost && <span className="shrink-0 tabular-nums">{cost}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {days !== undefined
          ? `${days > 0 ? "+" : ""}${days} ${Math.abs(days) === 1 ? "day" : "days"} to the programme`
          : <span className="font-medium text-foreground">No time claimed — the programme impact is being absorbed</span>}
        {instructedBy && ` · instructed by ${instructedBy}`}
        {date && ` · ${date}`}
      </p>
      <p className={cn("text-xs", risky ? "font-medium" : "text-muted-foreground")}>
        {WORD[state]}
        {risky && " — work is going ahead with the price still open"}
      </p>
    </li>
  );
}
