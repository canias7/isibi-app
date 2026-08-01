import { cn } from "@/lib/utils";
/**
 * How a total splits into net, tax and gross.
 *
 * IT SHOWS ALL THREE NUMBERS, ALWAYS. A total with "includes VAT" beside it
 * makes a business customer do the arithmetic to reclaim it, and they get it
 * wrong when the rate is not the one they assumed. Net, tax and gross on three
 * lines is the whole requirement.
 *
 * SEVERAL RATES ARE ORDINARY, not an edge case. A basket with food at one rate
 * and drink at another needs a line per rate, and a single "VAT" line is either
 * wrong or hides a blend nobody can reconcile against an invoice.
 *
 * THE RATE IS PRINTED WITH EACH LINE. "£4.20 tax" is unverifiable; "20% on
 * £21.00" can be checked in a second, which is what an accountant does with
 * every one of these.
 *
 * IT NAMES NO PARTICULAR COUNTRY'S TAX. The label is the caller's — VAT, GST,
 * sales tax — because a component that says VAT is wrong everywhere it is not
 * called that, and the arithmetic is identical.
 */
export type TaxLine = { id: string; label: string; rate: string; base: string; tax: string };

export function TaxBreakdown({ lines, net, total, taxLabel = "Tax", note, className }: {
  lines: TaxLine[];
  /** Pre-formatted total before tax. */
  net: string;
  /** Pre-formatted total including tax. */
  total: string;
  taxLabel?: string;
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <dl className="space-y-0.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Before {taxLabel.toLowerCase()}</dt>
          <dd className="tabular-nums">{net}</dd>
        </div>
        {lines.map((l) => (
          <div key={l.id} className="flex justify-between gap-3">
            <dt className="min-w-0 text-muted-foreground">
              {l.label}
              <span className="block text-xs">{l.rate} on {l.base}</span>
            </dt>
            <dd className="shrink-0 tabular-nums">{l.tax}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-border pt-1 font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">{total}</dd>
        </div>
      </dl>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
