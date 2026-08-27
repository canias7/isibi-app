import { cn } from "@/lib/utils";
/**
 * Telling somebody their prescription is waiting.
 *
 * PARTIAL IS THE STATE EVERYBODY FORGETS. Two of four items ready is neither
 * "ready" nor "not ready", and sending the first message makes somebody travel
 * for a bag that is missing the item they actually needed.
 *
 * THE OPENING HOURS ARE ON THE MESSAGE. "Ready to collect" arriving at nine in
 * the evening is a message that causes a wasted journey unless it says when the
 * door is open.
 *
 * A BAG THAT WILL BE RETURNED TO STOCK SAYS WHEN. Uncollected prescriptions are
 * broken down after a set period, and finding that out on arrival — after the
 * medicine has been dispensed and put back — is the avoidable version of this.
 *
 * WHO CAN COLLECT IT IS ANSWERED. Sending somebody else is normal and the rules
 * differ by item; leaving it unstated means a carer arrives and is turned away.
 */
export function ReadyToCollect({ patient, readyCount, totalCount, waitingFor = [], openingHours, returnedToStockAfter, collectBy, className }: {
  patient?: string;
  readyCount: number;
  totalCount: number;
  /** Named, not counted. */
  waitingFor?: string[];
  openingHours?: string;
  /** Free text — "14 days". */
  returnedToStockAfter?: string;
  /** Who may pick it up. */
  collectBy?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const partial = readyCount > 0 && readyCount < totalCount;
  const none = readyCount === 0;
  return (
    <div data-slot="ready-to-collect" className={cn("space-y-1 text-sm", className)}>
      <p className="font-medium tabular-nums">
        {none
          ? "Nothing is ready yet."
          : partial
            ? `${readyCount} of ${totalCount} ${totalCount === 1 ? "item" : "items"} ready${patient ? ` for ${patient}` : ""}.`
            : `Ready to collect${patient ? ` — ${patient}` : ""}.`}
      </p>
      {partial && waitingFor.length > 0 && (
        <p className="text-xs font-medium">
          Still waiting on {AND.format(waitingFor)}. Worth knowing before you set off.
        </p>
      )}
      {openingHours && <p className="text-xs text-muted-foreground">Open {openingHours}.</p>}
      {collectBy && <p className="text-xs text-muted-foreground">{collectBy}</p>}
      {returnedToStockAfter && !none && (
        <p className="text-xs text-muted-foreground">
          Uncollected bags go back to stock after {returnedToStockAfter}, and have to be dispensed again.
        </p>
      )}
    </div>
  );
}
