import { cn } from "@/lib/utils";
/**
 * Who the broker is paid by, and which lenders they can actually see.
 *
 * HOW THEY ARE PAID IS THE FIRST LINE, ALWAYS. A fee from the borrower, a
 * commission from the lender, or both, changes what an unbiased recommendation
 * even means — and it is invariably at the bottom of the page in small type. It
 * goes at the top here.
 *
 * THE SIZE OF THE PANEL IS STATED PLAINLY. "Whole of market", "a panel of
 * twelve" and "one lender" are three different services, and the middle one is
 * routinely presented as the first.
 *
 * A COMMISSION THAT DIFFERS BETWEEN LENDERS IS DISCLOSED AS SUCH. A flat
 * commission creates no incentive to steer; one that varies does, and that
 * distinction is the disclosure that actually matters.
 *
 * NO RATING OR STAR COUNT. It would be the broker's own, on their own page,
 * beside the disclosure it is meant to soften.
 */
export function BrokerNote({ name, paidBy = [], feeAmount, feeWhen, lendersCovered, panelKind = "panel", commissionVaries, currency = "GBP", locale = "en-GB", className }: {
  name?: string;
  /** The first line, deliberately. */
  paidBy?: string[];
  feeAmount?: number;
  /** "On application", "only on completion". */
  feeWhen?: string;
  lendersCovered?: number;
  panelKind?: "whole of market" | "panel" | "single lender";
  /** The disclosure that actually matters. */
  commissionVaries?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">
        {paidBy.length > 0 ? `Paid by ${AND.format(paidBy)}.` : "Nobody has said how this broker is paid."}
      </p>
      {feeAmount !== undefined && (
        <p className="text-xs tabular-nums">
          Their fee is {money(feeAmount)}
          {feeWhen ? `, ${feeWhen}` : ", and it has not been said when it is due"}.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {panelKind === "single lender"
          ? "Works with one lender only, so this is that lender's product rather than a comparison."
          : panelKind === "whole of market"
            ? "Says they can look across the whole market."
            : `Works from a panel${lendersCovered !== undefined ? ` of ${lendersCovered} ${lendersCovered === 1 ? "lender" : "lenders"}` : ""} — not the whole market.`}
      </p>
      {commissionVaries && (
        <p className="text-xs font-medium">
          The commission differs between lenders on their panel. That is a reason to ask why this one was picked.
        </p>
      )}
      {name && <p className="text-xs text-muted-foreground">{name}</p>}
    </div>
  );
}
