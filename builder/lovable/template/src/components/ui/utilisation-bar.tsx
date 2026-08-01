import { cn } from "@/lib/utils";
/**
 * How much of a period's capacity was actually used.
 *
 * 100% IS NOT THE TARGET AND THE COMPONENT SAYS SO. Every utilisation display
 * implies more is better, which is wrong for anything staffed by people: a
 * fully-booked day has no room for an overrun, a walk-in, or a break, so the
 * healthy band tops out well below full. `target` draws where good actually is.
 *
 * THE TARGET MARKER IS A LINE, NOT A COLOUR CHANGE. A bar that turns from one
 * hue to another at a threshold says nothing in greyscale; a notch is visible
 * however it is printed, and the state is written out beside the number.
 *
 * UNDER AND OVER ARE BOTH REPORTED, in the same neutral voice. Under-use is a
 * revenue problem and over-use is a burnout problem, and neither is a failure
 * the reader needs to be scolded about.
 *
 * IT COMPARES LIKE FOR LIKE. `used` and `available` are in the caller's own
 * unit — hours, chairs, slots — and the percentage is the only derived figure,
 * so nothing here has to know what is being measured.
 */
export function UtilisationBar({ used, available, target, unit = "hours", className }: {
  used: number;
  available: number;
  /** The healthy level, as a percentage. */
  target?: number;
  unit?: string;
  className?: string;
}) {
  if (!available || available <= 0) return null;
  const pct = (used / available) * 100;
  const state = target === undefined ? null
    : pct > target + 5 ? "above" : pct < target - 10 ? "below" : "about right";
  return (
    <div className={cn("space-y-1", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium tabular-nums">{Math.round(pct)}%</span>
        <span className="text-muted-foreground tabular-nums">
          {used.toLocaleString()} of {available.toLocaleString()} {unit}
        </span>
        {state && (
          <span className={cn("text-xs", state === "about right" ? "text-muted-foreground" : "font-medium")}>
            {state === "above" ? `above the ${target}% you aim for`
              : state === "below" ? `below the ${target}% you aim for`
              : "about right"}
          </span>
        )}
      </p>
      <div aria-hidden="true" className="relative h-2 w-full overflow-hidden rounded-full border border-border">
        <span style={{ width: `${Math.min(100, pct)}%` }} className="block h-full bg-foreground" />
        {target !== undefined && (
          <span style={{ left: `${Math.min(100, target)}%` }}
            className="absolute inset-y-0 w-px bg-background mix-blend-difference" />
        )}
      </div>
    </div>
  );
}
