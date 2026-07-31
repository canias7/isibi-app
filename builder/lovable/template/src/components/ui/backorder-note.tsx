import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Order now, we send it when it arrives" — with the wait stated.
 *
 * DIFFERENT FROM A PRE-ORDER: this item exists and is simply not here, so
 * the honest fact is the LEAD TIME, and it is an estimate that must be
 * labelled as one. "Usually 2–3 weeks" survives being wrong; "arrives 14
 * March" does not.
 *
 * PART-SHIPPING IS A CHOICE THE BUYER MAKES, not a default the shop picks:
 * some people want the in-stock half now, some want one parcel. Offering it
 * here is cheaper than a support ticket later.
 */
export function BackorderNote({ lead, onChoose, splitShip, className }: {
  lead: string;
  splitShip?: boolean;
  onChoose?: (split: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-md border border-dashed border-border p-2.5", className)}>
      <p className="text-xs">
        On backorder — usually <b>{lead}</b>. <span className="text-muted-foreground">An estimate, not a promised date.</span>
      </p>
      {onChoose ? (
        <div className="flex flex-col gap-0.5 text-xs">
          {[[false, "Send everything together"], [true, "Send what is in stock now, the rest later"]].map(([v, label]) => (
            <label key={String(v)} className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" name="split" checked={splitShip === v} onChange={() => onChoose(v as boolean)}
                className="size-3 cursor-pointer accent-foreground" />
              {label as string}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
