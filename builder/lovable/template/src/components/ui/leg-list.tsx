import { cn } from "@/lib/utils";
/**
 * A journey made of several legs, with the handovers visible.
 *
 * THE HANDOVER BETWEEN CARRIERS IS WHERE FREIGHT IS LOST. A single tracking
 * status hides that three companies are involved and that nobody owns the
 * middle — so a shipment stuck at a transfer looks the same as one in motion.
 * Each leg names its carrier.
 *
 * THE CURRENT LEG IS MARKED, because "in transit" on a four-leg journey means
 * very different things depending on which leg. It is also who to ring.
 *
 * A LEG WITH NO CARRIER IS FLAGGED, since an unbooked onward leg is the
 * commonest reason a shipment sits at a port for a week — booked to the port
 * and no further.
 *
 * MODE IS SHOWN AS A WORD. Sea, air, road and rail have order-of-magnitude
 * different durations and costs, and the leg list is where a route's shape
 * becomes obvious.
 */
export type Leg = {
  id: string;
  from: string;
  to: string;
  mode?: "road" | "rail" | "sea" | "air";
  carrier?: string;
  /** Free text — "14–18 August". */
  when?: string;
  state?: "done" | "current" | "todo";
};

export function LegList({ legs, className }: { legs: Leg[]; className?: string }) {
  const MODE = { road: "by road", rail: "by rail", sea: "by sea", air: "by air" };
  const unbooked = legs.filter((l) => !l.carrier && l.state !== "done");
  return (
    <div className={cn("space-y-1.5", className)}>
      {unbooked.length > 0 && (
        <p className="text-xs font-medium">
          {unbooked.length} {unbooked.length === 1 ? "leg has" : "legs have"} no carrier booked.
        </p>
      )}
      <ol className="divide-y divide-border rounded-md border border-border text-sm">
        {legs.map((l) => (
          <li key={l.id} className="flex items-start gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className={cn("block", l.state === "current" && "font-medium",
                l.state === "todo" && "text-muted-foreground")}>
                {l.from} <span aria-hidden="true">→</span> {l.to}
                {l.mode && <span className="font-normal text-muted-foreground"> {MODE[l.mode]}</span>}
              </span>
              <span className="block text-xs text-muted-foreground">
                {l.carrier ?? <span className="font-medium text-foreground">No carrier booked</span>}
                {l.when && ` · ${l.when}`}
              </span>
            </span>
            {l.state && (
              <span className={cn("shrink-0 text-xs", l.state === "current" ? "font-medium" : "text-muted-foreground")}>
                {l.state === "done" ? "Done" : l.state === "current" ? "Now" : "To come"}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
