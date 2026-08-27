import { cn } from "@/lib/utils";
/**
 * The same stay, priced here against the platform — with the saving COMPUTED.
 *
 * "BEST PRICE GUARANTEED" IS A CLAIM AND NOBODY BELIEVES IT. It appears on
 * every small hotel's site, it costs nothing to write, and a guest who has just
 * come from Booking.com has no way to check it without opening another tab —
 * which is the tab where they book. Two numbers and the difference between them
 * is checkable in one glance, and it is the whole argument for booking direct.
 *
 * THE SAVING IS DERIVED, never taken as a prop. Stored separately it drifts the
 * moment either price moves, and the direction it drifts is always flattering.
 * Same rule as `admission-prices` and `rate-card`: a business must not be able
 * to state a saving its own numbers do not support.
 *
 * AND IT CAN COME OUT ZERO OR NEGATIVE. Rate parity clauses are real and some
 * platforms forbid undercutting, so a site can honestly be the same price — in
 * which case this says so and shifts to what direct booking actually buys
 * (talking to a person, a late arrival, a cancelled booking sorted out in one
 * call). A component that can only report good news is an advert.
 *
 * `checked` IS REQUIRED. A comparison with no date is a comparison from any
 * month at all, and platform prices move weekly — an undated one that has gone
 * stale is worse than none, because it is a specific false claim about a named
 * third party rather than vague puffery. Same reasoning as `updated` on
 * `facility-status` and `when` on `inspection-rating`.
 *
 * THE PLATFORM IS NAMED, and only one. "Cheaper than the booking sites" is
 * unfalsifiable; "£132 on Booking.com" is a number the reader can go and check,
 * which is exactly why it persuades.
 */
export function DirectSaving({
  platform, platformPrice, ourPrice, checked, nights, currency = "GBP", locale = "en-GB",
  instead, heading = "Book direct", className,
}: {
  /** Named, and one of them. "The booking sites" persuades nobody. */
  platform: string;
  platformPrice: number;
  ourPrice: number;
  /** REQUIRED. "Checked 28 July" — an undated comparison is a claim from any year. */
  checked: string;
  /** What the two prices cover, so the comparison is like for like. */
  nights?: string | null;
  currency?: string;
  locale?: string;
  /** What direct booking buys when the price is the SAME. The honest fallback. */
  instead?: string;
  heading?: string;
  className?: string;
}) {
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const saving = platformPrice - ourPrice;
  return (
    <div data-slot="direct-saving" className={cn("rounded-lg border border-border p-6", className)}>
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
      <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
        <div>
          <dt className="text-sm text-muted-foreground">On {platform}</dt>
          <dd className="mt-1 text-2xl font-medium tabular-nums text-muted-foreground">{money(platformPrice)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Here</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(ourPrice)}</dd>
        </div>
      </dl>
      {/* NEGATIVE AND ZERO ARE REAL ANSWERS. Rate parity clauses exist, and a
          component that can only report good news is an advert. */}
      <p className="mt-4 text-base">
        {saving > 0 ? (
          <>
            <span className="font-semibold">You keep {money(saving)}</span>
            <span className="text-muted-foreground">
              {" "}— that is what {platform} charges us, and we would rather you had it.
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            The same price either way{saving < 0 ? `, and ${money(-saving)} less on ${platform} at the moment` : ""}.
            {instead ? ` ${instead}` : ""}
          </span>
        )}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {nights ? `${nights}. ` : ""}{platform} price checked {checked} and it moves — if it is lower today, tell us and we will match it.
      </p>
    </div>
  );
}
