import { cn } from "@/lib/utils";
/**
 * How a fixed quantity is divided up — committed, reserved, and free.
 *
 * RESERVED IS THE SEGMENT THAT MATTERS. Stock is not simply sold or available:
 * a chunk is spoken for by orders not yet shipped or baskets not yet paid, and
 * treating that as available is exactly how a shop sells the same last item
 * twice. A two-part bar cannot express it.
 *
 * THE FREE NUMBER IS PRINTED, not left to be read off a bar. That is the one
 * figure anybody acts on, and it is the one a proportional graphic is worst at
 * conveying when the slice is small.
 *
 * THE SEGMENTS ARE SOLID, HATCHED AND HOLLOW rather than three colours, so the
 * division survives greyscale and print — and the whole breakdown is in one
 * `sr-only` sentence, since a bar of divs is silent.
 *
 * OVER-ALLOCATION IS SHOWN RATHER THAN CLAMPED. If committed plus reserved
 * exceeds the total, that is a real and urgent state; a bar that silently
 * caps at 100% hides the only situation worth an alert.
 */
export function AllocationBar({ total, committed, reserved = 0, unit = "items", className }: {
  total: number;
  /** Already gone. */
  committed: number;
  /** Spoken for but not yet gone. */
  reserved?: number;
  unit?: string;
  className?: string;
}) {
  const used = committed + reserved;
  const free = total - used;
  const over = free < 0;
  const denom = Math.max(total, used, 1);
  const pct = (n: number) => `${(Math.max(0, n) / denom) * 100}%`;
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm">
        <span className={cn("tabular-nums", over ? "font-medium" : "font-medium")}>
          {over ? `${Math.abs(free).toLocaleString()} over` : free.toLocaleString()}
        </span>
        <span className="text-muted-foreground">
          {over ? ` — more is promised than you have` : ` ${unit} free of ${total.toLocaleString()}`}
        </span>
      </p>
      <span className="sr-only">
        {committed.toLocaleString()} committed, {reserved.toLocaleString()} reserved,{" "}
        {Math.max(0, free).toLocaleString()} free, of {total.toLocaleString()} {unit}.
      </span>
      <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full border border-border">
        <span style={{ width: pct(committed) }} className="bg-foreground" />
        <span style={{ width: pct(reserved) }}
          className="bg-[repeating-linear-gradient(45deg,var(--color-foreground)_0_2px,transparent_2px_5px)]" />
        <span style={{ width: pct(free) }} className="bg-transparent" />
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>{committed.toLocaleString()} committed</span>
        {reserved > 0 && <span>{reserved.toLocaleString()} reserved</span>}
      </p>
    </div>
  );
}
