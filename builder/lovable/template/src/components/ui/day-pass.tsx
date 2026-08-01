import { cn } from "@/lib/utils";
/**
 * A day's use of a space, priced with what is actually included.
 *
 * WHAT COSTS EXTRA IS LISTED BESIDE WHAT IS INCLUDED. A day pass that turns out
 * not to include a meeting room, printing or the phone booths is the single
 * complaint every flexible space gets, and it is entirely produced by listing
 * only the good half.
 *
 * IT SAYS WHETHER A DESK IS GUARANTEED. "Hot desking" means there may be nowhere
 * to sit at ten on a Tuesday, and somebody travelling in deserves that sentence
 * before they set off rather than on arrival.
 *
 * THE PRICE OF SEVERAL DAYS IS COMPARED WITH A MONTH. Anybody buying a fourth
 * day pass in a month is usually better off on a membership, and the space that
 * says so keeps the customer.
 *
 * NO COUNTDOWN OR SCARCITY BADGE. Whether four desks are left is a real fact and
 * belongs on the page; "book now, going fast" is not the same thing.
 */
export function DayPass({ price, includes = [], costsExtra = [], deskGuaranteed, desksLeft, monthlyPrice, passesBoughtThisMonth, currency = "GBP", locale = "en-GB", className }: {
  price: number;
  includes?: string[];
  /** Listed beside what is included, always. */
  costsExtra?: string[];
  deskGuaranteed?: boolean;
  /** A real number, not a scarcity badge. */
  desksLeft?: number;
  monthlyPrice?: number;
  passesBoughtThisMonth?: number;
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
  const breakEven = monthlyPrice !== undefined && price > 0 ? Math.ceil(monthlyPrice / price) : undefined;
  const betterOnMonthly =
    breakEven !== undefined && passesBoughtThisMonth !== undefined && passesBoughtThisMonth >= breakEven - 1;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="text-lg font-medium">{money(price)}</span>
        <span className="text-muted-foreground"> for the day</span>
      </p>
      {includes.length > 0 && <p className="text-xs text-muted-foreground">Includes {AND.format(includes)}.</p>}
      {costsExtra.length > 0 && <p className="text-xs">Not included: {AND.format(costsExtra)}.</p>}
      <p className={cn("text-xs", deskGuaranteed ? "text-muted-foreground" : "font-medium")}>
        {deskGuaranteed
          ? "A desk is held for you."
          : "Desks are first come, first served — on a busy morning there may be nowhere to sit."}
      </p>
      {desksLeft !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {desksLeft} {desksLeft === 1 ? "desk" : "desks"} free at the moment.
        </p>
      )}
      {betterOnMonthly && breakEven !== undefined && monthlyPrice !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          You have bought {passesBoughtThisMonth} this month. A membership is {money(monthlyPrice)} and works out
          cheaper from {breakEven} days.
        </p>
      )}
    </div>
  );
}
