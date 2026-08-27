import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * The last screen before paying — everything, with every part editable.
 *
 * EVERY SECTION HAS AN EDIT LINK THAT RETURNS HERE. The classic checkout
 * failure is going back to fix an address and losing your place in the flow;
 * an edit that dumps you at step one is why people abandon at the final
 * screen having already decided to buy.
 *
 * THE TOTAL IS BROKEN DOWN IN FULL — items, delivery, discount, tax — and
 * the arithmetic is done here rather than trusted, because a summary whose
 * parts do not add to its total is the single thing that destroys confidence
 * at the moment of paying. If they disagree, it says so rather than
 * rendering a comfortable lie.
 */
export function OrderReview({ sections, lines, totalMinor, currency = "GBP", className }: {
  sections: { key: string; title: string; body: React.ReactNode; onEdit?: () => void }[];
  lines: { label: string; amountMinor: number }[];
  totalMinor: number;
  currency?: string;
  className?: string;
}) {
  const fmt = (m: number) => formatMinor(m, currency);
  const sum = lines.reduce((s, l) => s + l.amountMinor, 0);
  const mismatch = sum !== totalMinor;

  return (
    <div data-slot="order-review" className={cn("flex flex-col gap-3", className)}>
      {sections.map((s) => (
        <section key={s.key} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.title}</h3>
            <div className="mt-0.5 text-sm">{s.body}</div>
          </div>
          {/* Returns HERE, not to step one. */}
          {s.onEdit ? (
            <button type="button" onClick={s.onEdit} className="cursor-pointer shrink-0 text-xs underline underline-offset-2">
              Change
            </button>
          ) : null}
        </section>
      ))}
      <dl className="flex flex-col gap-0.5 rounded-lg border border-border p-3 text-sm">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3 tabular-nums">
            <dt className="text-muted-foreground">{l.label}</dt>
            <dd>{l.amountMinor < 0 ? `−${fmt(-l.amountMinor)}` : fmt(l.amountMinor)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-border pt-1 font-semibold tabular-nums">
          <dt>Total</dt>
          <dd>{fmt(totalMinor)}</dd>
        </div>
        {mismatch ? (
          <p className="mt-1 text-xs font-medium">
            These lines add to {fmt(sum)}, which is not the total — do not charge this.
          </p>
        ) : null}
      </dl>
    </div>
  );
}
