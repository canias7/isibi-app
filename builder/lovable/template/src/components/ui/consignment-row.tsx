import { cn } from "@/lib/utils";
/**
 * A shipment — its reference, where it is, and when it is now expected.
 *
 * THE REVISED ETA IS SHOWN AGAINST THE ORIGINAL, not instead of it. A delivery
 * quietly re-promised three times looks on time each morning, and only the
 * original date reveals that it has slipped a week — which is the fact somebody
 * needs to tell a customer.
 *
 * THE CARRIER'S REFERENCE AND OURS ARE BOTH SHOWN. Any conversation with the
 * carrier uses theirs, and every internal system uses ours; a row carrying only
 * one makes somebody search two systems to join them.
 *
 * "IN TRANSIT" IS NOT A LOCATION. A status with no place is what makes tracking
 * useless — the last known scan point and its time are what let somebody judge
 * whether it is moving at all.
 *
 * A SHIPMENT WITH NO SCAN FOR DAYS IS FLAGGED. Lost freight looks exactly like
 * moving freight until somebody asks, and the silence is the only signal.
 */
export function ConsignmentRow({ reference, carrierReference, carrier, from, to, state, lastScanAt, lastScanPlace, eta, originalEta, staleDays, className }: {
  /** Our reference. */
  reference: string;
  /** Theirs. */
  carrierReference?: string;
  carrier?: string;
  from?: string;
  to?: string;
  state: "booked" | "collected" | "in-transit" | "delivered" | "exception";
  /** Free text — "2 days ago". */
  lastScanAt?: string;
  lastScanPlace?: string;
  /** Free text — "14 August". */
  eta?: string;
  /** What was first promised. */
  originalEta?: string;
  /** Days since the last scan. */
  staleDays?: number;
  className?: string;
}) {
  const WORD = {
    booked: "Booked", collected: "Collected", "in-transit": "On its way",
    delivered: "Delivered", exception: "Problem",
  } as const;
  const slipped = eta && originalEta && eta !== originalEta;
  const silent = staleDays !== undefined && staleDays >= 2 && state !== "delivered";
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <code className="font-mono text-xs">{reference}</code>
        {carrierReference && <code className="font-mono text-xs text-muted-foreground">{carrierReference}</code>}
        <span className={cn("ml-auto text-xs", state === "exception" ? "font-medium" : "text-muted-foreground")}>
          {WORD[state]}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {from && to ? `${from} → ${to}` : from ?? to}
        {carrier && ` · ${carrier}`}
      </p>
      <p className="text-xs text-muted-foreground">
        {lastScanPlace
          ? <>Last seen {lastScanPlace}{lastScanAt ? `, ${lastScanAt}` : ""}</>
          : "No scan recorded"}
      </p>
      {eta && (
        <p className={cn("text-xs", slipped ? "font-medium" : "text-muted-foreground")}>
          Due {eta}
          {slipped && <span className="font-normal text-muted-foreground"> · first promised {originalEta}</span>}
        </p>
      )}
      {silent && (
        <p className="text-xs font-medium">Nothing scanned for {staleDays} {staleDays === 1 ? "day" : "days"} — chase this.</p>
      )}
    </li>
  );
}
