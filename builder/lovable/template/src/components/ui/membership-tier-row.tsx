import { cn } from "@/lib/utils";
/**
 * A membership category — with who it is for and what it costs.
 *
 * CONCESSIONARY RATES ARE LISTED AS TIERS, NOT AS A DISCOUNT FOOTNOTE. A
 * student, unwaged or senior rate presented as a reduction off a "real" price
 * reads as charity; presented as a tier it reads as a category somebody
 * belongs to, and clubs that do the second get more of them.
 *
 * WHAT THE TIER ACTUALLY GRANTS IS LISTED. Voting rights, ground access,
 * bringing guests — these differ between tiers in ways nobody discovers until
 * they are refused at a door or at an AGM.
 *
 * A JOINING FEE IS SHOWN SEPARATELY FROM THE SUBSCRIPTION. It is a one-off and
 * folding it into the annual figure makes the first year look like the ongoing
 * cost, which is a complaint every club receives.
 *
 * A CLOSED OR WAITING-LIST TIER SAYS SO rather than being hidden, because
 * somebody needs to know whether to ask.
 */
export function MembershipTierRow({ name, forWhom, price, period = "a year", joiningFee, grants = [], canVote, waitingList, closed, currency = "GBP", locale = "en-GB", className }: {
  name: string;
  /** "Anyone in full-time education". */
  forWhom?: string;
  price?: number;
  period?: string;
  /** One-off, shown apart. */
  joiningFee?: number;
  /** What this tier gets. */
  grants?: string[];
  canVote?: boolean;
  waitingList?: boolean;
  closed?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
  return (
    <li data-slot="membership-tier-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {name}
          {forWhom && <span className="block text-xs text-muted-foreground">{forWhom}</span>}
        </span>
        {price !== undefined && <span className="shrink-0 tabular-nums">{money(price)} {period}</span>}
      </p>
      {joiningFee !== undefined && joiningFee > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Plus a one-off {money(joiningFee)} to join — not part of the annual cost.
        </p>
      )}
      {grants.length > 0 && <p className="text-xs text-muted-foreground">{grants.join(" · ")}</p>}
      {canVote !== undefined && (
        <p className="text-xs text-muted-foreground">
          {canVote ? "Can vote at the AGM." : "No vote at the AGM."}
        </p>
      )}
      {(closed || waitingList) && (
        <p className="text-xs font-medium">
          {closed ? "Closed to new members." : "There is a waiting list for this tier."}
        </p>
      )}
    </li>
  );
}
