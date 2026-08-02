import { cn } from "@/lib/utils";
/**
 * DIY, part or full livery — by the week, with what is NOT included.
 *
 * "SPACES AVAILABLE" IS SIX MONTHS OLD ON EVERY YARD'S WEBSITE IN THE COUNTRY,
 * so `spaces` is a number and zero says so plainly. A horse owner rings four
 * yards, gets four answers of "sorry, we're full", and the fifth call is the
 * one that finds a stable — publishing the count turns four wasted calls into
 * one useful one, in both directions.
 *
 * WHAT IS EXCLUDED IS THE FIELD PEOPLE ARE CAUGHT BY. Full livery at £180 a
 * week that does not include bedding, hay, worming or the farrier is not full
 * livery at £180 a week; part livery differs between yards by more than the
 * price does, and "part livery" alone means almost nothing. `excludes` is
 * required for that reason — an unstated exclusion reads as included, which is
 * the failure that ends up in a county Facebook group.
 *
 * WEEKLY, NOT MONTHLY, because that is how the trade quotes and how owners
 * compare — and a monthly figure invites the "which month" argument every
 * fourth week. A yard wanting to bill monthly still advertises by the week.
 *
 * A WAITING LIST IS A THIRD STATE, not a synonym for full. "Full, three
 * waiting" tells somebody whether to bother asking; "Full" alone reads as a
 * closed door and loses the person who would have waited six weeks.
 *
 * NO COLOUR ANYWHERE. Free, full and waiting-list are words and weights — a
 * yard's site is read on a phone in a barn, one-handed, in bad light.
 */
export type Livery = {
  name: string;
  /** Per week, per horse. */
  price: number;
  /** Free stables of this type RIGHT NOW. Zero is an answer, not an omission. */
  spaces: number;
  /** How many are waiting, when there are none free. Turns a closed door into a queue. */
  waiting?: number | null;
  includes: string[];
  /** REQUIRED. An unstated exclusion reads as included, which is the whole failure. */
  excludes: string[];
  note?: string | null;
};
export function LiveryPackages({
  packages, currency = "GBP", locale = "en-GB", heading = "Livery", note, className,
}: {
  packages: Livery[];
  currency?: string;
  locale?: string;
  heading?: string;
  note?: string;
  className?: string;
}) {
  if (!packages.length) return null;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const free = packages.reduce((s, p) => s + Math.max(0, p.spaces), 0);
  return (
    <div className={cn("", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
        {/* THE HEADLINE ANSWER. It is the only reason most people opened the
            page, and every yard makes them ring to get it. */}
        <p className="text-sm">
          {free > 0
            ? <><span className="font-semibold">{free} stable{free === 1 ? "" : "s"} free</span><span className="text-muted-foreground"> today</span></>
            : <span className="font-medium">Full at the moment</span>}
        </p>
      </div>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {packages.map((p) => (
          <li key={p.name} className="py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-base font-medium">{p.name}</span>
              <span className="text-base font-semibold tabular-nums">
                {money(p.price)}<span className="text-sm font-normal text-muted-foreground"> a week</span>
              </span>
            </div>
            <p className={cn("mt-1 text-sm", p.spaces > 0 ? "font-medium" : "text-muted-foreground")}>
              {p.spaces > 0
                ? `${p.spaces} free`
                : p.waiting
                  ? `None free — ${p.waiting} waiting`
                  : "None free, and nobody waiting — worth asking"}
            </p>
            <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Included</p>
                <ul className="mt-1.5 space-y-1 text-sm leading-relaxed">
                  {p.includes.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </div>
              <div>
                {/* THE FIELD PEOPLE ARE CAUGHT BY. Full livery that excludes
                    bedding and hay is not full livery, and an unstated
                    exclusion reads as included. */}
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Not included</p>
                <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-muted-foreground">
                  {p.excludes.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </div>
            </div>
            {p.note && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.note}</p>}
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
