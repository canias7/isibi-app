import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The plan a gated feature belongs to — worn by the feature, visibly.
 *
 * IT NAMES THE TIER, NOT A PADLOCK. A lock says "no"; "Pro" says what
 * changes it, which is the difference between a wall and a price. Pressing
 * it goes to upgrading (the caller's flow) — the badge is the entire
 * pitch, one word long.
 *
 * GATED FEATURES STAY VISIBLE — the discipline this component assumes and
 * its header states: people cannot want what they cannot see, the pricing
 * page already lists the feature, and a menu that reshapes itself per plan
 * is a different app per customer. Render the feature disabled with this
 * badge beside it; never remove it.
 *
 * It is a small outline chip — quiet, because a page shouting PRO on six
 * rows is an advert wearing a settings screen.
 */
export function UpgradeBadge({ tier, onUpgrade, className }: {
  tier: string;
  onUpgrade?: () => void;
  className?: string;
}) {
  const chip = "inline-flex items-center rounded-full border border-foreground px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide";
  if (!onUpgrade) return <span className={cn(chip, className)}>{tier}</span>;
  return (
    <button type="button" onClick={onUpgrade}
      title={`Included in ${tier}`}
      className={cn(chip, "cursor-pointer hover:bg-foreground hover:text-background", className)}>
      {tier}
    </button>
  );
}
