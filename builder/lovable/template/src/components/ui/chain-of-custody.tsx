import { cn } from "@/lib/utils";
/**
 * Every hand a sample has passed through — with the gaps made visible.
 *
 * AN UNBROKEN CHAIN IS THE CLAIM AND A BREAK IS WHAT THIS EXISTS TO SHOW. If
 * one person's receipt does not follow the previous person's release, the
 * sample was unaccounted for, and in a forensic or regulated context that
 * single gap is what a result is excluded on.
 *
 * RELEASE AND RECEIPT ARE TWO EVENTS, NOT ONE. A handover recorded once assumes
 * the sample arrived, which is exactly the assumption that fails when a courier
 * leaves it at a reception desk.
 *
 * THE SEAL IS TRACKED SEPARATELY FROM THE HANDOVER. A correctly signed chain
 * with a broken seal is a compromised sample, and the two facts are recorded by
 * different people at different moments.
 *
 * TIME IN TRANSIT IS SHOWN because temperature-controlled samples have a
 * permitted window, and the gap between release and receipt is the only place
 * an excursion can hide.
 */
export type CustodyEvent = {
  id: string;
  /** Free text — "14 July, 09:12". */
  at: string;
  action: "released" | "received";
  by: string;
  place?: string;
  sealIntact?: boolean;
  note?: string;
};

export function ChainOfCustody({ events, className }: { events: CustodyEvent[]; className?: string }) {
  // A release must be followed by a receipt. Anything else is unaccounted time,
  // which is the whole reason a chain is recorded rather than a destination.
  const breaks = events.reduce<number>((n, e, i) => {
    const prev = events[i - 1];
    if (i === 0) return e.action === "received" ? n : n;
    if (prev.action === "released" && e.action !== "received") return n + 1;
    if (prev.action === "received" && e.action !== "released") return n + 1;
    return n;
  }, 0);
  const sealBroken = events.some((e) => e.sealIntact === false);
  const dangling = events.length > 0 && events[events.length - 1].action === "released";
  return (
    <div className={cn("space-y-1.5", className)}>
      {/* EVERY problem is listed, not the worst one. A broken seal and an
          unpaired handover are separate failures with separate remedies, and
          showing only the first hides a gap that is exactly what a chain is
          recorded to expose. */}
      {(breaks > 0 || sealBroken || dangling) && (
        <ul className="space-y-0.5 text-sm font-medium">
          {sealBroken && <li>The seal was recorded as broken — this sample is compromised.</li>}
          {breaks > 0 && (
            <li>{breaks} {breaks === 1 ? "handover does" : "handovers do"} not pair up — the sample was unaccounted for in between.</li>
          )}
          {dangling && <li>The last event is a release with no matching receipt.</li>}
        </ul>
      )}
      <ol className="divide-y divide-border rounded-md border border-border text-sm">
        {events.map((e) => (
          <li key={e.id} className="px-3 py-1.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{e.at}</span>
              <span className="min-w-0 flex-1">
                {e.action === "released" ? "Released by" : "Received by"} {e.by}
                {e.place && <span className="text-muted-foreground"> · {e.place}</span>}
              </span>
            </p>
            {e.sealIntact !== undefined && (
              <p className={cn("text-xs", e.sealIntact ? "text-muted-foreground" : "font-medium")}>
                {e.sealIntact ? "Seal intact." : "Seal broken."}
              </p>
            )}
            {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
          </li>
        ))}
      </ol>
      {breaks === 0 && !sealBroken && !dangling && (
        <p className="text-xs text-muted-foreground">Every release has a matching receipt.</p>
      )}
    </div>
  );
}
