import { cn } from "@/lib/utils";
/**
 * A reagent on the shelf — with the two expiries it actually has.
 *
 * THE OPENED DATE MATTERS MORE THAN THE PRINTED EXPIRY. Most reagents have a
 * short in-use life once broached — often 30 days against a two-year unopened
 * date — and a stock system tracking only the manufacturer's date lets a
 * long-expired working solution be used with confidence.
 *
 * THE LOT NUMBER IS SHOWN BECAUSE IT IS WHAT A RESULT IS TRACED TO. A batch
 * recall, or an unexplained shift in a control, is investigated by lot, and a
 * record with only a product name cannot answer it.
 *
 * "ENOUGH LEFT FOR THE NEXT RUN" IS THE ANSWER SOMEBODY WANTS. Amount remaining
 * against amount needed is the question at the bench, and a bare quantity makes
 * them do the arithmetic.
 *
 * STORAGE IS PART OF THE ROW. A reagent found on the wrong shelf has an unknown
 * history, and stating the requirement is how anybody notices.
 */
export function ReagentRow({ name, lot, amountLeft, unit, neededForNextRun, expiresOn, openedOn, openLifeDays, storage, className }: {
  name: string;
  lot?: string;
  amountLeft?: number;
  unit?: string;
  /** What the next planned run consumes. */
  neededForNextRun?: number;
  /** The manufacturer's date, free text. */
  expiresOn?: string;
  /** Free text — when it was broached. */
  openedOn?: string;
  /** In-use life once opened. */
  openLifeDays?: number;
  /** "−20°C", "2–8°C, protect from light". */
  storage?: string;
  className?: string;
}) {
  const short = amountLeft !== undefined && neededForNextRun !== undefined && amountLeft < neededForNextRun;
  const u = unit ? ` ${unit}` : "";
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {name}
          {lot && <span className="block font-mono text-xs text-muted-foreground">Lot {lot}</span>}
        </span>
        {amountLeft !== undefined && (
          <span className={cn("shrink-0 tabular-nums", short && "font-medium")}>{amountLeft}{u} left</span>
        )}
      </p>
      {short && neededForNextRun !== undefined && amountLeft !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          The next run needs {neededForNextRun}{u} — {neededForNextRun - amountLeft}{u} short.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {expiresOn && `Expires ${expiresOn}`}
        {expiresOn && storage ? " · " : ""}
        {storage}
      </p>
      {openedOn ? (
        <p className="text-xs">
          Opened {openedOn}
          {openLifeDays !== undefined && ` — in-use life ${openLifeDays} ${openLifeDays === 1 ? "day" : "days"}, which is what actually applies`}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Unopened.</p>
      )}
    </li>
  );
}
