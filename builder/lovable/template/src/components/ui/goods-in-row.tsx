import { cn } from "@/lib/utils";
/**
 * A delivery line being booked in — ordered, delivered, accepted.
 *
 * THREE NUMBERS, NOT TWO. Ordered, delivered and accepted are all different and
 * a system carrying two of them cannot express the ordinary case: 100 ordered,
 * 100 delivered, 96 accepted and 4 damaged. Collapsing accepted into delivered
 * pays a supplier for goods sitting in the reject cage.
 *
 * THE REJECT REASON IS PART OF THE LINE. A short-paid invoice needs it, the
 * supplier will ask for it, and nobody can reconstruct it a week later.
 *
 * OVER-DELIVERY IS CALLED OUT. It is quietly accepted far more often than it is
 * refused, and it is stock nobody ordered, in a bin somebody else's pick will
 * find — worth a decision at the door rather than a surprise at the count.
 *
 * THE PURCHASE-ORDER LINE IS SHOWN, because a booking-in dispute is settled by
 * pointing at the order, and searching for it afterwards is the whole delay.
 */
export function GoodsInRow({ item, poLine, ordered, delivered, accepted, rejectReason, className }: {
  item: string;
  /** "PO-4471 line 3". */
  poLine?: string;
  ordered: number;
  delivered: number;
  /** Undefined until somebody checks. */
  accepted?: number;
  /** Why the rest was not accepted. */
  rejectReason?: string;
  className?: string;
}) {
  const checked = accepted !== undefined;
  const rejected = checked ? delivered - accepted : 0;
  const over = delivered > ordered;
  const short = delivered < ordered;
  return (
    <li data-slot="goods-in-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {item}
          {poLine && <span className="block text-xs text-muted-foreground">{poLine}</span>}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {ordered} ordered · {delivered} delivered
          {checked && ` · ${accepted} accepted`}
        </span>
      </p>
      {rejected > 0 && (
        <p className="text-xs font-medium tabular-nums">
          {rejected} rejected{rejectReason ? ` — ${rejectReason}` : " — no reason recorded"}
        </p>
      )}
      {over && (
        <p className="text-xs font-medium tabular-nums">
          {delivered - ordered} more than ordered — accept or refuse before it is put away.
        </p>
      )}
      {short && !checked && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {ordered - delivered} short of the order.
        </p>
      )}
      {!checked && <p className="text-xs text-muted-foreground">Not yet checked.</p>}
    </li>
  );
}
