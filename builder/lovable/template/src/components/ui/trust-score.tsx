import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Trust shown as FACTS, not a number.
 *
 * THERE IS DELIBERATELY NO `score` PROP. An opaque 87/100 cannot be explained
 * to the person it describes, cannot be argued with by the person reading it,
 * and optimising it becomes the game — the three standing failures of trust
 * scores. What earns trust is checkable facts: how long they have been here,
 * how much they have completed, how they respond. So the API takes facts and
 * a WORD for the tier, and refuses at the type level to render a bare number.
 *
 * THE TIER IS A WORD from a closed set — "New here" is a neutral statement,
 * not a warning; everyone was new once, and painting newness as risk is how
 * marketplaces strangle their own supply.
 *
 * Facts are label/value pairs in a real <dl>; the tier chip is filled only
 * for "trusted", weight carrying the difference — monochrome, as ever.
 */
export type TrustTier = "new" | "established" | "trusted";

const TIER_LABEL: Record<TrustTier, string> = {
  new: "New here",
  established: "Established",
  trusted: "Trusted",
};

export function TrustScore({ tier, facts, className }: {
  tier: TrustTier;
  facts: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div data-slot="trust-score" className={cn("inline-flex flex-col gap-2 rounded-xl border border-border bg-card p-3", className)}>
      <span className={cn("self-start rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tier === "trusted" ? "border-foreground bg-foreground text-background"
          : tier === "established" ? "border-foreground" : "border-border text-muted-foreground")}>
        {TIER_LABEL[tier]}
      </span>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {facts.map((f, i) => (
          <React.Fragment key={i}>
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="text-xs font-medium tabular-nums">{f.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}
