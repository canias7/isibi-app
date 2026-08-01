import { cn } from "@/lib/utils";
/**
 * What is being offered — with the arithmetic that produced it.
 *
 * THE WORKING IS SHOWN. Claimed, less excess, less wear-and-tear, less
 * unsupported items, equals offered. An offer presented as a single figure
 * cannot be checked, and every disputed settlement starts with somebody unable
 * to see where their money went.
 *
 * ACCEPTING IS DISCLOSED AS FINAL WHERE IT IS. Many settlements close the claim
 * permanently, including for damage found later, and that is the fact most
 * often absent from the letter.
 *
 * CASH AND REPLACEMENT ARE DIFFERENT OFFERS AND ARE LABELLED. A cash settlement
 * is frequently lower than the replacement the insurer could arrange, which is a
 * legitimate choice and only if it is visible.
 *
 * THE ROUTE TO DISAGREE IS INCLUDED IN THE OFFER, not in the small print.
 * Somebody who thinks it is too low needs to know it can be queried without
 * losing the offer already on the table.
 */
export type Deduction = { id: string; label: string; amount: number };

export function SettlementOffer({ claimed, deductions = [], offered, kind = "cash", isFinal, replacementAlternative, disputeNote, respondBy, currency = "GBP", locale = "en-GB", className }: {
  claimed?: number;
  deductions?: Deduction[];
  offered: number;
  kind?: "cash" | "replacement" | "repair";
  /** True where accepting closes the claim for good. */
  isFinal?: boolean;
  /** What the alternative would be. */
  replacementAlternative?: string;
  disputeNote?: string;
  respondBy?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
  const KIND = { cash: "as a cash settlement", replacement: "as a replacement we arrange", repair: "as a repair we arrange" }[kind];
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{money(offered)}</span>
        <span className="text-muted-foreground"> {KIND}</span>
      </p>
      {(claimed !== undefined || deductions.length > 0) && (
        <ul className="divide-y divide-border rounded-md border border-border text-xs">
          {claimed !== undefined && (
            <li className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">You claimed</span>
              <span className="shrink-0 tabular-nums">{money(claimed)}</span>
            </li>
          )}
          {deductions.map((d) => (
            <li key={d.id} className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1 text-muted-foreground">{d.label}</span>
              <span className="shrink-0 tabular-nums">−{money(d.amount)}</span>
            </li>
          ))}
          <li className="flex items-baseline gap-3 px-3 py-1.5 font-medium">
            <span className="min-w-0 flex-1">Offered</span>
            <span className="shrink-0 tabular-nums">{money(offered)}</span>
          </li>
        </ul>
      )}
      {replacementAlternative && <p className="text-xs">{replacementAlternative}</p>}
      <p className={cn("text-xs", isFinal ? "font-medium" : "text-muted-foreground")}>
        {isFinal
          ? "Accepting closes this claim for good, including for damage found later."
          : "Accepting does not stop you claiming for anything found later."}
      </p>
      {disputeNote && <p className="text-xs">{disputeNote}</p>}
      {respondBy && <p className="text-xs text-muted-foreground">Please reply by {respondBy}.</p>}
    </div>
  );
}
