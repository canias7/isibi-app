import { cn } from "@/lib/utils";
/**
 * A currency board — both directions, with the spread computed and printed.
 *
 * THE SPREAD IS THE COMMISSION. Every bureau in the country advertises "0%
 * commission" and it is true and it is not the price: the money is made on the
 * gap between what they sell a currency at and what they buy it back at. A
 * board showing only the sell rate is not a simplification, it is the one
 * number that hides the charge — so both directions are required to appear
 * together or the row does not claim a spread at all.
 *
 * THE SPREAD IS DERIVED, NEVER PASSED. A stored percentage beside a stored pair
 * of rates disagrees with them the moment somebody updates one at nine in the
 * morning and forgets the other — the `league-table` rule, and here the drifting
 * number is the one a customer would use to decide. It is expressed against the
 * mid-market rate, which is how the comparison sites express it, so the figure
 * on this board is the figure somebody can hold against theirs.
 *
 * `setAt` IS REQUIRED. A rate without a timestamp is a claim rather than a
 * price: rates move all day, a board photographed at nine is wrong by four, and
 * every disputed counter transaction starts with "the website said". Making it
 * optional would mean the commonest possible use of this component is the
 * dishonest one.
 *
 * IT IS LABELLED FROM THE CUSTOMER'S SIDE. Trade boards say "we buy / we sell"
 * and roughly half of everybody reads them backwards, because the customer is
 * doing the opposite of whatever the sign says. "You get" and "You pay back"
 * cannot be read the wrong way round.
 *
 * NO COLOUR, and there is nothing here that wants it: a wide spread is not an
 * error and a tight one is not a success, they are just numbers, and tinting
 * them would be the shop grading its own prices.
 *
 * A CURRENCY NOT HELD IN BRANCH SAYS SO ON THE ROW. Turning up for Vietnamese
 * dong on a Saturday and being told it is a two-day order is the complaint this
 * one line prevents, and the rate is real either way.
 */
export type BoardRate = {
  /** ISO code — "EUR". */
  code: string;
  name: string;
  /** Units of this currency you GET for one of the base. */
  sell: number;
  /** Units you must GIVE to get one of the base back. Null where it is not bought back. */
  buy?: number | null;
  /** Not held in branch — ordered in. */
  order?: boolean;
  note?: string | null;
};
export function RateBoard({
  rates, setAt, base = "GBP", baseSymbol = "£", note, className,
}: {
  rates: BoardRate[];
  /** When the board was set. Required: a rate with no time is a claim. */
  setAt: string;
  base?: string;
  baseSymbol?: string;
  note?: string;
  className?: string;
}) {
  if (!rates.length) return null;
  // PRECISION IS RELATIVE, NOT ABSOLUTE, and the first draft of this got it
  // wrong in a way only a render could show. Four decimals on 1.1420 is right —
  // that fourth digit is worth about 0.01% of the transaction and it is what an
  // argument at the counter turns on. The SAME four decimals on a rate of
  // 30,150 dong printed "30150.0000", which is not how any bureau on earth
  // writes a rate and which makes the column unreadable down its length. So the
  // significant figures are held constant instead: five, capped at four
  // decimals, grouped, which lands on 1.1420 · 41.200 · 182.40 · 30,150.
  const n = (v: number) => {
    const digits = v > 0 ? Math.floor(Math.log10(v)) + 1 : 1;
    const dp = Math.min(4, Math.max(0, 5 - digits));
    return v.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  };
  const spread = (r: BoardRate) => {
    if (r.buy == null || r.buy <= 0 || r.sell <= 0) return null;
    const mid = (r.buy + r.sell) / 2;
    return ((r.buy - r.sell) / mid) * 100;
  };
  return (
    <div className={cn("font-mono", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-foreground pb-2">
        <p className="text-xs uppercase tracking-[0.16em]">
          Rates per {baseSymbol}1 {base}
        </p>
        {/* The timestamp sits with the board, not in a footnote. */}
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Set {setAt}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <th scope="col" className="py-2 pe-4 text-start font-normal">Currency</th>
              <th scope="col" className="px-3 py-2 text-end font-normal">You get</th>
              <th scope="col" className="px-3 py-2 text-end font-normal">You pay back</th>
              <th scope="col" className="py-2 ps-3 text-end font-normal">Spread</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => {
              const s = spread(r);
              return (
                <tr key={r.code} className="border-b border-border align-baseline last:border-0">
                  <th scope="row" className="py-2.5 pe-4 text-start font-normal">
                    <span className="font-medium">{r.code}</span>
                    <span className="text-muted-foreground"> · {r.name}</span>
                    {r.order && (
                      <span className="block text-xs text-muted-foreground">Ordered in — two working days</span>
                    )}
                    {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
                  </th>
                  <td className="px-3 py-2.5 text-end tabular-nums">{n(r.sell)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">
                    {r.buy == null ? (
                      <span className="text-xs text-muted-foreground">not bought back</span>
                    ) : (
                      n(r.buy)
                    )}
                  </td>
                  <td className="py-2.5 ps-3 text-end tabular-nums">
                    {s == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      `${s.toFixed(1)}%`
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* The sentence that makes the spread column mean something. Without it
          the number is decoration on a board nobody knows how to read. */}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        The spread is the gap between the two rates, against the mid-market rate. It is what this
        exchange costs you, whatever any commission is or is not called.
      </p>
      {note && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
