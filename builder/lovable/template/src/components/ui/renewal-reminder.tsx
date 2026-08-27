import { cn } from "@/lib/utils";
/**
 * A subscription coming up for renewal — with what lapsing costs.
 *
 * THE CONSEQUENCE OF LAPSING IS THE PERSUASIVE PART, and it is usually
 * specific: losing a place on a waiting list, losing continuous-membership
 * years, paying a joining fee again. A reminder that only says a date is a
 * reminder people ignore twice and then act on too late.
 *
 * THE GRACE PERIOD IS STATED. Most clubs have one and almost none publish it,
 * so members either panic or assume there is more slack than there is.
 *
 * IT SAYS WHETHER IT RENEWS ITSELF. A standing order the member set up years ago
 * is not something the club can see, and telling somebody to pay when they
 * already do is how a club takes two subscriptions.
 *
 * NOTHING COUNTS DOWN IN HOURS. This is a club subscription, not a flash sale,
 * and a ticking clock on it reads as manipulation because it is.
 */
export function RenewalReminder({ tier, dueOn, daysLeft, price, graceDays, losesOnLapse = [], autoRenews, alreadyPaid, currency = "GBP", locale = "en-GB", className }: {
  tier?: string;
  /** Free text — "1 September". */
  dueOn?: string;
  daysLeft?: number;
  price?: number;
  /** How long after the date membership survives. */
  graceDays?: number;
  /** What lapsing actually costs. */
  losesOnLapse?: string[];
  autoRenews?: boolean;
  /** True where a payment has already been received. */
  alreadyPaid?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = price !== undefined
    ? new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(price) ? 0 : 2, maximumFractionDigits: 2 }).format(price)
    : undefined;
  const soon = daysLeft !== undefined && daysLeft <= 14;
  if (alreadyPaid) {
    return (
      <div data-slot="renewal-reminder" className={cn("space-y-0.5 text-sm", className)}>
        <p>Your subscription is paid{tier ? ` — ${tier}` : ""}. Nothing to do.</p>
        {dueOn && <p className="text-xs text-muted-foreground">Next due {dueOn}.</p>}
      </div>
    );
  }
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(soon && "font-medium")}>
        {dueOn ? `Your subscription is due on ${dueOn}` : "Your subscription is due"}
        {money && <span className="font-normal text-muted-foreground"> · {money}</span>}
        {daysLeft !== undefined && (
          <span className="tabular-nums"> — {daysLeft <= 0 ? "overdue" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}.</span>
        )}
      </p>
      {tier && <p className="text-xs text-muted-foreground">{tier}</p>}
      {autoRenews && (
        <p className="text-xs">
          This renews itself — if you pay by standing order, do not pay again.
        </p>
      )}
      {graceDays !== undefined && (
        <p className="text-xs text-muted-foreground">
          Membership continues for {graceDays} {graceDays === 1 ? "day" : "days"} after the date.
        </p>
      )}
      {losesOnLapse.length > 0 && (
        <p className="text-xs">If it lapses you lose {losesOnLapse.join(", ")}.</p>
      )}
    </div>
  );
}
