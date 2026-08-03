import { cn } from "@/lib/utils";
/**
 * The four facts that decide whether a trade buyer can deal with you at all.
 *
 * EVERY TRADE SITE HIDES THE MINIMUM ORDER BEHIND A LOGIN, and it wastes both
 * parties' morning: the buyer registers, waits for approval, signs in, and
 * discovers the minimum is £500 when they wanted £80 of stock. Publishing it
 * loses nobody who was ever going to buy — it only loses the enquiry that was
 * never going to convert, which is the enquiry that costs a salesperson an
 * afternoon.
 *
 * CARRIAGE-PAID IS THE NUMBER BUYERS ACTUALLY PLAN AROUND, not the minimum.
 * A £250 minimum with free delivery over £400 means every order is £400, and
 * the £400 is the figure that shapes a purchase order. So it is stated beside
 * the minimum rather than in a delivery FAQ two pages away.
 *
 * "ACCOUNT REQUIRED" IS ANSWERED YES OR NO, never left to be inferred. Whether
 * a stranger can buy today or must wait a week for credit checks is the
 * difference between this being a shop and this being a relationship, and a
 * buyer with an urgent gap needs to know which in five seconds.
 *
 * DELIVERY DAYS ARE DAYS, not "nationwide delivery". A merchant who reaches a
 * postcode on Tuesdays and Fridays cannot serve somebody whose site pours
 * concrete on Wednesdays, and "next day" printed by a business that is not
 * next-day is how a trade account gets closed after one job.
 *
 * ANY OF THE FOUR MAY BE ABSENT and the block simply shortens — but an absent
 * one is silent rather than rendered as "—", because a dash in a terms panel
 * reads as "none" and "no minimum order" is a very different claim from "we
 * have not said".
 */
const COLS = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" } as const;
export function TradeTerms({
  minimumOrder, carriagePaid, paymentTerms, accountRequired, deliveryDays,
  currency = "GBP", locale = "en-GB", heading = "Trade terms", note, className, columns = 3, }: {
  minimumOrder?: number | null;
  /** Order value above which delivery is free. The number buyers plan around. */
  carriagePaid?: number | null;
  /** "30 days from invoice", "pro forma", "card on collection". */
  paymentTerms?: string | null;
  /** Yes or no, never inferred. Can a stranger buy today? */
  accountRequired?: boolean;
  /** Which days you actually reach them: ["Tuesday", "Friday"]. */
  deliveryDays?: string[];
  currency?: string;
  locale?: string;
  heading?: string;
  note?: string;
  /** How many across at the widest. The parent knows its room; the CSS cannot. */
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const items: { label: string; value: string; sub?: string }[] = [];
  if (typeof minimumOrder === "number") {
    items.push({
      label: "Minimum order",
      value: minimumOrder > 0 ? money(minimumOrder) : "None",
      sub: minimumOrder > 0 ? "Trade price, before VAT" : "Buy one if that is all you need",
    });
  }
  if (typeof carriagePaid === "number") {
    items.push({
      label: "Free delivery over",
      value: money(carriagePaid),
      sub: "Below it, carriage is charged at cost",
    });
  }
  if (paymentTerms) items.push({ label: "Payment", value: paymentTerms });
  if (accountRequired !== undefined) {
    items.push({
      label: "Account",
      value: accountRequired ? "Required" : "Not needed",
      sub: accountRequired ? "Apply below — it takes two working days" : "Anybody in the trade can buy today",
    });
  }
  if (deliveryDays && deliveryDays.length) {
    items.push({
      label: "We deliver",
      value: deliveryDays.join(", "),
      sub: "Order the working day before, by 15:00",
    });
  }
  if (!items.length) return null;
  return (
    <div className={cn("rounded-lg border border-border p-6", className)}>
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
      <dl className={cn("mt-4 grid gap-x-8 gap-y-5", COLS[columns])}>
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-sm text-muted-foreground">{i.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{i.value}</dd>
            {i.sub && <dd className="mt-0.5 text-sm text-muted-foreground">{i.sub}</dd>}
          </div>
        ))}
      </dl>
      {note && <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
