import { cn } from "@/lib/utils";
/**
 * How an object entered the collection — and what due diligence was done.
 *
 * THE DUE-DILIGENCE CHECKS ARE LISTED INDIVIDUALLY, met or not. "Provenance
 * checked" as a single tick is what allows a looted or illegally exported object
 * through, and each register searched is a separate, checkable fact.
 *
 * A GAP IN THE OWNERSHIP HISTORY IS RECORDED AT ACQUISITION, not discovered
 * later. The 1933–1945 period and any export after 1970 are the two that carry
 * legal weight in most jurisdictions, and both are frequently unexamined at the
 * point of accession when examining them is easiest.
 *
 * CONDITIONS ATTACHED BY THE DONOR ARE PART OF THE RECORD. "Must always be on
 * display" and "must never be lent" bind the museum for decades, are routinely
 * forgotten within one curatorial generation, and are then breached.
 *
 * THE VALUE IS SHOWN SEPARATELY FROM WHAT WAS PAID, because a gift with a tax
 * valuation, a bargain purchase and a full-price acquisition raise entirely
 * different questions.
 */
export type DiligenceCheck = { id: string; register: string; done?: boolean; note?: string };

export function AcquisitionNote({ object, method, from, on, paid, valuation, checks = [], provenanceGaps, donorConditions = [], currency = "GBP", locale = "en-GB", className }: {
  object?: string;
  /** "Purchase", "Gift", "Bequest", "Transfer", "Field collection". */
  method: string;
  from?: string;
  /** Free text — "14 March 2026". */
  on?: string;
  /** What was actually paid, in major units. */
  paid?: number;
  /** What it was valued at, in major units. */
  valuation?: number;
  checks?: DiligenceCheck[];
  /** Free text describing any unexplained period. */
  provenanceGaps?: string;
  /** Restrictions the donor attached, which bind for decades. */
  donorConditions?: string[];
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const undone = checks.filter((c) => !c.done);
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{method}</span>
        {from && <span className="text-muted-foreground"> from {from}</span>}
        {object && <span className="block text-xs text-muted-foreground">{object}</span>}
      </p>
      {(on || paid !== undefined || valuation !== undefined) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {on}
          {on && (paid !== undefined || valuation !== undefined) ? " · " : ""}
          {paid !== undefined && `${money(paid)} paid`}
          {paid !== undefined && valuation !== undefined ? " · " : ""}
          {valuation !== undefined && `valued at ${money(valuation)}`}
        </p>
      )}
      {checks.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-xs">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                {c.register}
                {c.note && <span className="block text-muted-foreground">{c.note}</span>}
              </span>
              <span className={cn("shrink-0", c.done ? "text-muted-foreground" : "font-medium")}>
                {c.done ? "Searched" : "Not searched"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {undone.length > 0 && (
        <p className="text-xs font-medium">
          {undone.length} {undone.length === 1 ? "check has" : "checks have"} not been done.
        </p>
      )}
      {provenanceGaps && <p className="text-xs font-medium">Ownership gap: {provenanceGaps}</p>}
      {donorConditions.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs">Conditions attached, binding indefinitely:</p>
          <ul className="text-xs text-muted-foreground">
            {donorConditions.map((d, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true">—</span><span>{d}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
