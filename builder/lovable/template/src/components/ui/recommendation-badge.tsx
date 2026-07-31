import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Recommended" — with the reason attached.
 *
 * A RECOMMENDATION WITHOUT A REASON IS AN ADVERTISEMENT. "Most popular" on the
 * middle tier of a pricing table is the oldest trick in the book, and people
 * know it — so the reason is a required prop, not an optional one. "Recommended
 * — the only tier with more than one user" is a claim somebody can check and
 * disagree with.
 *
 * IT SAYS WHO IT IS RECOMMENDED FOR when that is known. "Best for a shop with
 * two or three chairs" is genuinely useful and is not the same claim as "best".
 *
 * IT IS NOT THE ONLY DIFFERENCE between the options. A badge that is the sole
 * distinguishing mark is decoration; the option itself has to stand up, and the
 * badge is a pointer.
 *
 * One per set. Two "recommended" badges is a set with no recommendation, and
 * the component cannot enforce that — so it is said here.
 */
export function RecommendationBadge({ reason, forWhom, label = "Recommended", className }: {
  reason: React.ReactNode;
  forWhom?: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1.5", className)}>
      <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
        <Sparkles aria-hidden className="size-2.5" />
        {label}
      </span>
      {/* Required, because a recommendation without one is an advertisement. */}
      <span className="text-xs text-muted-foreground">
        {forWhom ? <>for {forWhom} &mdash; </> : null}
        {reason}
      </span>
    </span>
  );
}
