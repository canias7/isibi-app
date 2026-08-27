import { cn } from "@/lib/utils";
/**
 * What has to be handed over at the end of a job, and what is still missing.
 *
 * FINAL PAYMENT USUALLY DEPENDS ON THIS PACK and almost nobody assembles it
 * until the end. Certificates, warranties, as-built drawings and O&M manuals
 * come from a dozen subcontractors who have already left site — so the missing
 * count is the number that decides when the job actually closes.
 *
 * EACH ITEM SAYS WHO OWES IT. A checklist of missing documents with no owner is
 * a list the main contractor chases blind; naming the subcontractor turns it
 * into phone calls.
 *
 * "RECEIVED BUT NOT CHECKED" IS A REAL STATE. A pack accepted without reading
 * routinely contains the wrong revision or a certificate for a different
 * building, discovered when a regulator asks.
 *
 * THE CLIENT'S OWN REQUIREMENTS ARE THE LIST. There is no universal set — it is
 * whatever the contract asked for — so the items are the caller's, not ours.
 */
export type HandoverItem = {
  id: string;
  label: string;
  state: "missing" | "received" | "checked";
  owedBy?: string;
  note?: string;
};

export function HandoverPack({ items, blocksPayment, className }: {
  items: HandoverItem[];
  /** True when final payment depends on it. */
  blocksPayment?: boolean;
  className?: string;
}) {
  const missing = items.filter((i) => i.state === "missing");
  const unchecked = items.filter((i) => i.state === "received");
  const WORD = { missing: "Missing", received: "Not checked", checked: "Done" } as const;
  return (
    <div data-slot="handover-pack" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {missing.length === 0 && unchecked.length === 0
          ? <span className="text-muted-foreground">Everything is in and checked</span>
          : <>
              <span className="font-medium tabular-nums">{missing.length}</span> missing
              {unchecked.length > 0 && (
                <span className="text-muted-foreground tabular-nums"> · {unchecked.length} in but not checked</span>
              )}
            </>}
        {blocksPayment && missing.length > 0 && (
          <span className="block text-xs text-muted-foreground">Final payment is held until these are in.</span>
        )}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className={cn("block", i.state === "missing" && "font-medium")}>{i.label}</span>
              <span className="block text-xs text-muted-foreground">
                {i.state === "missing" ? (i.owedBy ? `Owed by ${i.owedBy}` : "Nobody assigned") : i.note}
              </span>
            </span>
            <span className={cn("shrink-0 text-xs", i.state === "checked" ? "text-muted-foreground" : "font-medium")}>
              {WORD[i.state]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
