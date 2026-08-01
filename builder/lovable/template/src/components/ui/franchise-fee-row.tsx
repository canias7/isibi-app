import { cn } from "@/lib/utils";
/**
 * What a franchisee owes this period — with the basis, which is the argument.
 *
 * A ROYALTY ON GROSS AND ONE ON NET ARE DIFFERENT DEALS and the difference is
 * most of a franchisee's margin. Showing the percentage without the base is
 * how a fee statement becomes unarguable — and it is exactly what is argued
 * about.
 *
 * THE MARKETING LEVY IS SHOWN APART FROM THE ROYALTY. They are separate
 * obligations, often at different rates, and one usually comes with a duty for
 * the franchisor to actually spend it — which is a question a franchisee can
 * only ask if the figures are separate.
 *
 * A MINIMUM FEE IS DISCLOSED WHERE IT BITES. Minimums are invisible in a good
 * month and are the whole bill in a bad one, and that is when somebody is
 * reading this most carefully.
 *
 * THE TOTAL IS COMPUTED FROM THE LINES. A fee statement whose total can
 * disagree with its own components is the least forgivable place for that bug.
 */
export type FeeLine = { id: string; label: string; percent?: number; amount: number; basis?: string };

export function FranchiseFeeRow({ site, period, revenueBasis, revenue, lines, minimumApplied, minimumAmount, currency = "GBP", locale = "en-GB", className }: {
  site?: string;
  period?: string;
  /** "gross sales excluding tax". */
  revenueBasis?: string;
  revenue?: number;
  lines: FeeLine[];
  /** True where a minimum replaced the calculated fee. */
  minimumApplied?: boolean;
  minimumAmount?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  // Computed, never passed: a fee statement that disagrees with itself is the
  // one thing a franchisee will never let go of.
  const total = lines.reduce((n, l) => n + l.amount, 0);
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm">
        {site && <span className="font-medium">{site}</span>}
        {period && <span className="text-muted-foreground"> · {period}</span>}
      </p>
      {revenue !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {money(revenue)} {revenueBasis ?? "revenue, basis not stated"}
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {lines.map((l) => (
          <li key={l.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {l.label}
              {(l.percent !== undefined || l.basis) && (
                <span className="block text-xs text-muted-foreground">
                  {l.percent !== undefined && `${l.percent}%`}
                  {l.percent !== undefined && l.basis ? " of " : ""}
                  {l.basis}
                </span>
              )}
            </span>
            <span className="shrink-0 tabular-nums">{money(l.amount)}</span>
          </li>
        ))}
        <li className="flex items-baseline gap-3 px-3 py-1.5 font-medium">
          <span className="min-w-0 flex-1">Due</span>
          <span className="shrink-0 tabular-nums">{money(total)}</span>
        </li>
      </ul>
      {minimumApplied && minimumAmount !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          The {money(minimumAmount)} minimum applied this period — the calculated fee was lower.
        </p>
      )}
    </div>
  );
}
