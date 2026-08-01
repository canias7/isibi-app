import { cn } from "@/lib/utils";
/**
 * What the premium is made of — including the parts that are not insurance.
 *
 * FEES ARE SEPARATED FROM THE RISK PREMIUM. An administration fee, a broker
 * commission and an instalment charge are not the price of cover, and lumping
 * them in makes a policy look more expensive than a competitor whose fees
 * appear later.
 *
 * THE COST OF PAYING MONTHLY IS SHOWN AS AN INTEREST RATE, because it is credit
 * — often at a rate nobody would accept if it were labelled as a loan, and it
 * is disproportionately taken by people who cannot pay annually.
 *
 * TAX IS SHOWN SEPARATELY. It is not the insurer's money and it is not
 * negotiable, and a customer comparing prices should know which part of the
 * difference is the government's.
 *
 * THE TOTAL IS COMPUTED FROM THE PARTS, not passed in. Two numbers that can
 * disagree eventually will, and on a bill that is the thing people notice and
 * never forgive.
 */
export type PremiumPart = { id: string; label: string; amount: number; isFee?: boolean };

export function PremiumBreakdown({ parts, tax, monthlyTotal, monthlyAprPercent, currency = "GBP", locale = "en-GB", className }: {
  parts: PremiumPart[];
  /** Insurance tax, shown apart. */
  tax?: number;
  /** What twelve payments come to, where monthly is offered. */
  monthlyTotal?: number;
  /** The interest rate on paying monthly. */
  monthlyAprPercent?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
  // Computed, never passed in: a total that can disagree with its parts
  // eventually will, and a bill is where that is least forgivable.
  const total = parts.reduce((n, p) => n + p.amount, 0) + (tax ?? 0);
  const fees = parts.filter((p) => p.isFee).reduce((n, p) => n + p.amount, 0);
  const extra = monthlyTotal !== undefined ? monthlyTotal - total : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {parts.map((p) => (
          <li key={p.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {p.label}
              {p.isFee && <span className="text-xs text-muted-foreground"> · a fee, not cover</span>}
            </span>
            <span className="shrink-0 tabular-nums">{money(p.amount)}</span>
          </li>
        ))}
        {tax !== undefined && (
          <li className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1 text-muted-foreground">Insurance tax — not ours, and not negotiable</span>
            <span className="shrink-0 tabular-nums">{money(tax)}</span>
          </li>
        )}
        <li className="flex items-baseline gap-3 px-3 py-1.5 font-medium">
          <span className="min-w-0 flex-1">Paid in one go</span>
          <span className="shrink-0 tabular-nums">{money(total)}</span>
        </li>
      </ul>
      {fees > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {money(fees)} of this is fees rather than cover.
        </p>
      )}
      {monthlyTotal !== undefined && (
        <p className="text-xs tabular-nums">
          Paying monthly comes to {money(monthlyTotal)}
          {extra !== undefined && extra > 0 && <> — {money(extra)} more</>}
          {monthlyAprPercent !== undefined && <span className="font-medium"> at {monthlyAprPercent}% APR. This is credit.</span>}
        </p>
      )}
    </div>
  );
}
