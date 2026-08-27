import { cn } from "@/lib/utils";
/**
 * The offer — every part of it, including the parts that are not money.
 *
 * BASE PAY IS SEPARATED FROM EVERYTHING ELSE. A total-compensation headline
 * mixing guaranteed salary with a discretionary bonus and an unvested equity
 * estimate is not a number anybody can plan on, and the base is the only part
 * that survives a bad year.
 *
 * CONDITIONS ARE LISTED BEFORE THE DEADLINE. References, a right-to-work check,
 * a background check — an offer is not firm until they clear, and somebody
 * resigning on the strength of a conditional offer is taking a risk they should
 * be told about explicitly.
 *
 * THE DEADLINE IS SHOWN WITH WHETHER IT CAN MOVE. Exploding offers are a
 * pressure tactic; where the date really is flexible, saying so costs nothing
 * and removes an unnecessary bad decision.
 *
 * THE START DATE IS PART OF THE OFFER because a notice period frequently makes
 * it impossible, and that is a negotiation to have now rather than after
 * accepting.
 */
export function OfferSummary({ role, basePay, payPeriod = "a year", bonusNote, equityNote, benefits = [], startOn, conditions = [], respondBy, deadlineFlexible, currency = "GBP", locale = "en-GB", className }: {
  role?: string;
  basePay?: number;
  payPeriod?: string;
  /** Discretionary and separate, deliberately. */
  bonusNote?: string;
  equityNote?: string;
  benefits?: string[];
  /** Free text — "1 October". */
  startOn?: string;
  /** What must clear before it is firm. */
  conditions?: string[];
  respondBy?: string;
  deadlineFlexible?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = basePay !== undefined
    ? new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(basePay)
    : undefined;
  return (
    <div data-slot="offer-summary" className={cn("space-y-1 text-sm", className)}>
      {role && <p className="font-medium">{role}</p>}
      <p className="tabular-nums">
        {money ? `${money} ${payPeriod}` : "No base pay stated"}
        <span className="block text-xs text-muted-foreground">Base pay — guaranteed, and separate from anything below.</span>
      </p>
      {(bonusNote || equityNote) && (
        <ul className="text-xs text-muted-foreground">
          {bonusNote && <li>{bonusNote}</li>}
          {equityNote && <li>{equityNote}</li>}
        </ul>
      )}
      {benefits.length > 0 && <p className="text-xs text-muted-foreground">{benefits.join(" · ")}</p>}
      {startOn && <p className="text-xs">Starting {startOn}.</p>}
      {conditions.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs font-medium">This offer is conditional on:</p>
          <ul className="text-xs text-muted-foreground">
            {conditions.map((c, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true">—</span><span>{c}</span></li>
            ))}
          </ul>
          <p className="text-xs">It is not firm until these clear — think carefully before resigning.</p>
        </div>
      )}
      {respondBy && (
        <p className="text-xs">
          Please reply by {respondBy}.
          {deadlineFlexible && <span className="block text-muted-foreground">If you need longer, ask — this date can move.</span>}
        </p>
      )}
    </div>
  );
}
