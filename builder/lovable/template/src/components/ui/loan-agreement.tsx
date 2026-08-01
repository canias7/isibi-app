import { cn } from "@/lib/utils";
/**
 * An object going out on loan — with the conditions the borrower must meet.
 *
 * THE INSURANCE VALUE AND WHO INSURES ARE BOTH SHOWN, because a loan
 * agreement's most expensive ambiguity is which party's policy is in force in
 * transit — and the answer is frequently "neither, for four hours".
 *
 * A COURIER REQUIREMENT IS AN OBLIGATION WITH A COST, and it is named. Objects
 * requiring an accompanying courier cannot simply be shipped, and a borrower
 * discovering that after budgeting is a loan that falls through late.
 *
 * THE ENVIRONMENTAL AND DISPLAY CONDITIONS ARE PART OF THE AGREEMENT rather than
 * an attachment, because they are what the lender is actually agreeing to and
 * what a facilities report is checked against.
 *
 * THE RETURN DATE IS SHOWN AGAINST THE DISPLAY LIMIT. A light-sensitive object
 * lent for a six-month show has usually spent its whole permitted exposure for
 * five years, and the person approving the loan should see both figures at once.
 */
export function LoanAgreement({ object, borrower, venue, outOn, backOn, insuranceValue, insuredBy, courierRequired, conditions = [], displayLimitNote, currency = "GBP", locale = "en-GB", className }: {
  object: string;
  borrower: string;
  venue?: string;
  /** Free text — "14 September 2026". */
  outOn?: string;
  backOn?: string;
  /** In major units. */
  insuranceValue?: number;
  /** "the borrower, nail to nail". */
  insuredBy?: string;
  courierRequired?: boolean;
  /** Environmental and display conditions. */
  conditions?: string[];
  /** How this loan sits against the object's permitted exposure. */
  displayLimitNote?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = insuranceValue !== undefined
    ? new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(insuranceValue)
    : undefined;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{object}</span>
        <span className="block text-xs text-muted-foreground">
          To {borrower}{venue ? `, ${venue}` : ""}
        </span>
      </p>
      {(outOn || backOn) && (
        <p className="text-xs text-muted-foreground">
          {outOn && `Out ${outOn}`}
          {outOn && backOn ? " · " : ""}
          {backOn && `back ${backOn}`}
        </p>
      )}
      {money && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Insured value {money}
        </p>
      )}
      <p className={cn("text-xs", insuredBy ? "text-muted-foreground" : "font-medium")}>
        {insuredBy
          ? `Insured by ${insuredBy}.`
          : "No insurer recorded — agree who covers it in transit before it leaves."}
      </p>
      {courierRequired && (
        <p className="text-xs font-medium">
          A courier must travel with it — the borrower pays for that.
        </p>
      )}
      {conditions.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {conditions.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true">—</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
      {displayLimitNote && <p className="text-xs font-medium">{displayLimitNote}</p>}
    </div>
  );
}
