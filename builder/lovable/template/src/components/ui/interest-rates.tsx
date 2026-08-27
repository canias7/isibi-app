import { cn } from "@/lib/utils";

/**
 * What a lender or savings provider actually pays or charges, with the
 * conditions attached to the number rather than printed underneath it.
 *
 * THE CONDITIONS ARE THE PRODUCT. A savings account paying 4.6% that drops to
 * 1.1% after twelve months, or allows three withdrawals a year, is a different
 * account from one paying 4.4% flat — and every rate table that puts the
 * headline in a big font and the conditions in a footnote is describing the
 * first as if it were the second. So `conditions` sits in the same row and
 * renders as a list, not as an asterisk.
 *
 * `basis` IS REQUIRED AND PRINTED, because 4.6% means three different things.
 * AER is what a saver earns in a year with compounding; APR is what a borrower
 * pays including fees; APRC is the mortgage one covering the whole term. A
 * bare percentage next to "savings" and another next to "loans" invites the
 * comparison that regulators wrote these three acronyms to prevent.
 *
 * `representative` MARKS THE RATE MOST PEOPLE WILL NOT GET. A representative
 * APR is legally the rate offered to at least 51% of accepted applicants —
 * which means up to half of them are quoted something worse, and nobody reading
 * a table knows that unless it says so. Marked in words, in the row.
 *
 * No colour: a rate is a number and a condition is a sentence, and neither is
 * improved by being green. Figures are tabular so a column of them lines up.
 */
export type Rate = {
  name: string;
  /** The figure as written, e.g. "4.6%". A string, because "from 6.9%" is a real answer. */
  rate: string;
  basis: "AER" | "APR" | "APRC" | "gross";
  /** What it costs you to have it. Rendered in the row, never as a footnote. */
  conditions?: string[];
  /** True where the figure is a representative APR — i.e. up to half of applicants are offered worse. */
  representative?: boolean;
  /** "£500 to £25,000", "1 to 5 years". */
  range?: string | null;
};

export function InterestRates({ rates, caption, className }: {
  rates: Rate[];
  caption?: string;
  className?: string;
}) {
  if (!rates.length) return null;
  return (
    <div data-slot="interest-rates" className={cn("space-y-3", className)}>
      <ul className="divide-y divide-border border-y border-border">
        {rates.map((r) => (
          <li key={r.name} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-medium">{r.name}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums">{r.rate}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{r.basis}</span>
              </span>
            </div>
            {r.range && <p className="mt-0.5 text-sm text-muted-foreground">{r.range}</p>}
            {r.representative && (
              <p className="mt-1 text-sm text-muted-foreground">
                Representative — at least 51% of accepted applicants are offered this.
                The rest are offered a higher rate.
              </p>
            )}
            {r.conditions?.length ? (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {r.conditions.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
    </div>
  );
}
