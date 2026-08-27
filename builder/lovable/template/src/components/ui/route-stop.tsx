import { cn } from "@/lib/utils";
/**
 * One drop on a route — its window, and whether the plan still meets it.
 *
 * A MISSED WINDOW IS FORECAST, NOT REPORTED. The value of a route list is
 * seeing at 09:00 that the fourth drop will be late, while there is still time
 * to reorder or ring ahead — a component that only marks stops late after the
 * fact is a record rather than a tool.
 *
 * BOOKING-IN REQUIREMENTS ARE PART OF THE STOP. A delivery to a site that
 * needs a slot booked, or that closes for lunch, fails on arrival — and that
 * information lives in somebody's head or a note nobody reads.
 *
 * THE ACCESS NOTE IS SHOWN, because "no artic access, use the rear gate" is
 * what turns a two-hour delay into a normal delivery, and it is the single
 * most useful field on any drop.
 *
 * TIMES ARE THE PLANNER'S, not computed here. Traffic, service time and
 * sequence belong to a routing engine, and a component inventing an ETA would
 * disagree with the one the driver has.
 */
export function RouteStop({ sequence, name, address, windowFrom, windowTo, eta, willBeLate, mustBookIn, access, className }: {
  sequence?: number;
  name: string;
  address?: string;
  /** Free text — "08:00". */
  windowFrom?: string;
  windowTo?: string;
  /** Planned arrival. */
  eta?: string;
  /** Set by the planner when the ETA misses the window. */
  willBeLate?: boolean;
  /** True when a slot has to be booked. */
  mustBookIn?: boolean;
  /** "No artic access, use the rear gate". */
  access?: string;
  className?: string;
}) {
  return (
    <li data-slot="route-stop" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        {sequence !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{sequence}.</span>}
        <span className="min-w-0 flex-1">{name}</span>
        {(windowFrom || windowTo) && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {windowFrom && windowTo ? `${windowFrom}–${windowTo}` : windowFrom ?? windowTo}
          </span>
        )}
      </p>
      {address && <p className="text-xs text-muted-foreground">{address}</p>}
      {eta && (
        <p className={cn("text-xs", willBeLate ? "font-medium" : "text-muted-foreground")}>
          Planned {eta}
          {willBeLate && " — this misses the window"}
        </p>
      )}
      {mustBookIn && <p className="text-xs font-medium">A slot must be booked before arriving.</p>}
      {access && <p className="text-xs">{access}</p>}
    </li>
  );
}
