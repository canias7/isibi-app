import { cn } from "@/lib/utils";
/**
 * Where a batch came from and where it went — the recall question.
 *
 * IT ANSWERS BOTH DIRECTIONS AND THAT IS WHY IT EXISTS. Backwards is "what went
 * into this" (a supplier's lot, a component batch); forwards is "who has it
 * now". A recall needs the second and a fault investigation needs the first,
 * and a trace that only walks one way is half a system.
 *
 * THE FORWARD LIST IS THE URGENT ONE and it is shown first. When a batch is
 * being recalled, the list of customers holding it is the work; the supplier
 * lineage is the follow-up.
 *
 * QUANTITIES ARE SHOWN AT EVERY EDGE. "Sent to four customers" is not actionable
 * — "42 to one and 3 to three others" tells you which call is the priority.
 *
 * UNACCOUNTED STOCK IS STATED. Received minus shipped minus on-hand is rarely
 * zero, and the gap is the part of a recall nobody can close; showing it is
 * better than a total that quietly balances.
 */
export type TraceEdge = { id: string; party: string; quantity?: number; on?: string; reference?: string };

export function BatchTrace({ batch, receivedQuantity, onHandQuantity, cameFrom = [], wentTo = [], className }: {
  batch: string;
  /** Total received into this batch. */
  receivedQuantity?: number;
  /** Still in stock. */
  onHandQuantity?: number;
  /** Supplier lots that fed it. */
  cameFrom?: TraceEdge[];
  /** Customers and orders it went out on. */
  wentTo?: TraceEdge[];
  className?: string;
}) {
  const shipped = wentTo.reduce((n, e) => n + (e.quantity ?? 0), 0);
  const unaccounted =
    receivedQuantity !== undefined && onHandQuantity !== undefined
      ? receivedQuantity - onHandQuantity - shipped
      : undefined;
  return (
    <div className={cn("space-y-2 text-sm", className)}>
      <p>
        <span className="font-medium">Batch <span className="font-mono">{batch}</span></span>
        {receivedQuantity !== undefined && (
          <span className="block text-xs tabular-nums text-muted-foreground">
            {receivedQuantity} received
            {onHandQuantity !== undefined && ` · ${onHandQuantity} still in stock`}
            {wentTo.length > 0 && ` · ${shipped} shipped`}
          </span>
        )}
      </p>
      <div className="space-y-1">
        <p className="text-xs font-medium">Went to {wentTo.length} {wentTo.length === 1 ? "customer" : "customers"}</p>
        {wentTo.length === 0 ? (
          <p className="text-xs text-muted-foreground">None of this batch has shipped.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {wentTo.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 px-3 py-1.5">
                <span className="min-w-0 flex-1">
                  {e.party}
                  {(e.reference || e.on) && (
                    <span className="block text-xs text-muted-foreground">
                      {e.reference}
                      {e.reference && e.on ? " · " : ""}
                      {e.on}
                    </span>
                  )}
                </span>
                {e.quantity !== undefined && (
                  <span className="shrink-0 tabular-nums">{e.quantity}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {cameFrom.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Made from</p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {cameFrom.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 px-3 py-1.5">
                <span className="min-w-0 flex-1">
                  {e.party}
                  {e.reference && <span className="block font-mono text-xs text-muted-foreground">{e.reference}</span>}
                </span>
                {e.quantity !== undefined && <span className="shrink-0 tabular-nums">{e.quantity}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {unaccounted !== undefined && unaccounted !== 0 && (
        <p className="text-xs font-medium tabular-nums">
          {Math.abs(unaccounted)} {Math.abs(unaccounted) === 1 ? "unit" : "units"} {unaccounted > 0 ? "unaccounted for" : "more shipped than received"}.
        </p>
      )}
    </div>
  );
}
