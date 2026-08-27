import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * One order, several parcels — and what is still to come.
 *
 * THE UNSHIPPED REMAINDER IS THE POINT. Showing two "dispatched" emails and
 * no account of the third item is the commonest source of "where is the rest
 * of my order", and a component that lists only the parcels that exist
 * cannot answer it. Anything not in a parcel gets its own block, named.
 *
 * PARCELS ARE NUMBERED "1 of 3", which is what the customer is holding —
 * a tracking number alone does not tell somebody whether to keep waiting.
 *
 * A CANCELLED OR REFUNDED LINE IS SHOWN, not silently dropped, because a
 * missing item and a refunded item look identical from the doorstep.
 */
export function PartialShipment({ parcels, remaining, className }: {
  parcels: { key: string; items: React.ReactNode[]; carrier?: string; tracking?: string; state: "packed" | "sent" | "delivered" }[];
  remaining?: { items: React.ReactNode[]; why?: React.ReactNode }[];
  className?: string;
}) {
  const total = parcels.length + (remaining?.length ? 1 : 0);
  return (
    <div data-slot="partial-shipment" className={cn("flex flex-col gap-2", className)}>
      {parcels.map((p, i) => (
        <div key={p.key} className="rounded-lg border border-border p-2.5">
          <p className="text-xs font-semibold">
            Parcel {i + 1} of {total}
            <span className="font-normal text-muted-foreground">
              {" · "}{p.state === "delivered" ? "delivered" : p.state === "sent" ? "on its way" : "packed, not sent yet"}
              {p.carrier ? ` · ${p.carrier}` : ""}
            </span>
          </p>
          <ul className="mt-0.5 text-xs text-muted-foreground">
            {p.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
          {p.tracking ? <p className="mt-0.5 font-mono text-[11px]">{p.tracking}</p> : null}
        </div>
      ))}
      {/* The question a parcel list cannot answer on its own. */}
      {remaining?.length ? remaining.map((r, i) => (
        <div key={i} className="rounded-lg border border-dashed border-foreground p-2.5">
          <p className="text-xs font-semibold">Still to come</p>
          <ul className="mt-0.5 text-xs text-muted-foreground">
            {r.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
          {r.why ? <p className="mt-0.5 text-[11px]">{r.why}</p> : null}
        </div>
      )) : null}
    </div>
  );
}
