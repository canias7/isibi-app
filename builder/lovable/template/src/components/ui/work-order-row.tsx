import { cn } from "@/lib/utils";
/**
 * One job on the floor — quantity made against quantity wanted.
 *
 * GOOD AND SCRAP ARE COUNTED SEPARATELY. A work order for 500 that has made 500
 * with 40 scrapped has made 460, and a single "completed" figure lets that
 * order close 40 short — discovered at dispatch, which is the expensive place
 * to discover it.
 *
 * THE DUE DATE IS SHOWN AGAINST WHAT IS LEFT, not on its own. "Due Friday" is
 * only alarming next to "310 still to make", and a planner scanning twenty
 * orders needs both in the same glance.
 *
 * A HELD ORDER SAYS WHY AND WHO. Orders sit on hold for a missing component, a
 * quality query, a customer change — three completely different jobs to unblock,
 * and "on hold" alone means somebody has to go and ask.
 *
 * OVER-PRODUCTION IS FLAGGED. Making more than ordered is stock nobody wanted,
 * paid for in material and time, and it happens constantly on a line that is
 * set up and running.
 */
export function WorkOrderRow({ reference, product, ordered, good = 0, scrapped = 0, dueOn, holdReason, heldBy, className }: {
  reference: string;
  product: string;
  ordered: number;
  /** Made and passed. */
  good?: number;
  /** Made and rejected. */
  scrapped?: number;
  /** Free text — "Friday". */
  dueOn?: string;
  /** Why it is stopped. */
  holdReason?: string;
  heldBy?: string;
  className?: string;
}) {
  const left = ordered - good;
  const over = good > ordered;
  return (
    <li data-slot="work-order-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {product}
          <span className="block font-mono text-xs text-muted-foreground">{reference}</span>
        </span>
        <span className="shrink-0 tabular-nums">
          {good} of {ordered} good
        </span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {over ? `${good - ordered} more than ordered` : `${left} still to make`}
        {scrapped > 0 && ` · ${scrapped} scrapped`}
        {dueOn && ` · due ${dueOn}`}
      </p>
      {holdReason && (
        <p className="text-xs font-medium">
          On hold: {holdReason}
          {heldBy && ` (${heldBy})`}
        </p>
      )}
      {over && <p className="text-xs font-medium">Over-produced — stop the line before more is made.</p>}
    </li>
  );
}
