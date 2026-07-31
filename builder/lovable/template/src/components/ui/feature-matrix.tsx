import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Features down the side, plans across the top — the table under a pricing
 * page.
 *
 * A tick and a DASH, never a tick and a cross. This is the same rule
 * `comparison-table` follows: colour alone does not survive greyscale or print,
 * and a red cross reads as broken rather than as not-included. Both carry a
 * `sr-only` word, so a screen reader hears "included" and "not included"
 * instead of two unnamed images.
 *
 * A value may be TEXT as well as a boolean — "10 GB", "3 users", "Unlimited" —
 * because half the rows on a real pricing table are limits rather than
 * switches, and a matrix that only holds ticks forces those into the footnotes.
 *
 * Rows GROUP under headings, since a feature list past about a dozen lines is
 * unreadable flat, and the groups are what a customer scans for.
 */
export function FeatureMatrix({
  plans, groups, highlight, className,
}: {
  plans: { key: string; label: React.ReactNode; note?: React.ReactNode }[];
  groups: { key: string; label?: React.ReactNode; features: { key: string; label: React.ReactNode; hint?: React.ReactNode; values: Record<string, boolean | string> }[] }[];
  highlight?: string;
  className?: string;
}) {
  const cell = (v: boolean | string | undefined) => {
    if (v === true) return (<><Check aria-hidden className="mx-auto size-4" /><span className="sr-only">Included</span></>);
    if (v === false || v == null) return (<><Minus aria-hidden className="mx-auto size-4 text-muted-foreground" /><span className="sr-only">Not included</span></>);
    return <span className="text-xs">{v}</span>;
  };
  return (
    <div className={cn("overflow-x-auto rounded-md border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="sticky left-0 z-1 bg-muted px-3 py-2 text-left font-medium">Feature</th>
            {plans.map((p) => (
              <th key={p.key} scope="col"
                className={cn("min-w-24 bg-muted px-3 py-2 text-center align-top font-semibold",
                  p.key === highlight && "bg-foreground text-background")}>
                <span className="block whitespace-nowrap">{p.label}</span>
                {p.note ? (
                  <span className={cn("block text-xs font-normal",
                    p.key === highlight ? "text-background/80" : "text-muted-foreground")}>{p.note}</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            {g.label ? (
              <tr className="border-b border-border bg-muted/40">
                <th scope="colgroup" colSpan={plans.length + 1}
                  className="px-3 py-1.5 text-left text-xs font-semibold tracking-wide uppercase">
                  {g.label}
                </th>
              </tr>
            ) : null}
            {g.features.map((f) => (
              <tr key={f.key} className="border-b border-border last:border-0">
                <th scope="row" className="sticky left-0 z-1 bg-background px-3 py-2 text-left font-normal">
                  <span className="block">{f.label}</span>
                  {f.hint ? <span className="block text-xs text-muted-foreground">{f.hint}</span> : null}
                </th>
                {plans.map((p) => (
                  <td key={p.key} className={cn("px-3 py-2 text-center", p.key === highlight && "bg-muted/60")}>
                    {cell(f.values[p.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
