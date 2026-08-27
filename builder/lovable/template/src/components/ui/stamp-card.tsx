import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Buy nine, get the tenth — as the card people already understand.
 *
 * `checklist-dot` COUNTS TASKS toward a setup being finished. This counts
 * visits toward a PRIZE, which changes what every part means: the last space
 * is the reward and is drawn differently, the count is "3 more to go" rather
 * than a percentage, and a completed card is a thing to redeem rather than a
 * thing to dismiss.
 *
 * THE REWARD IS NAMED ON THE CARD. "Free coffee" is why anyone collects;
 * a grid of ticks with the prize on another screen is a chore.
 *
 * A FULL CARD SWITCHES TO A REDEEM STATE rather than sitting at 10/10 — a
 * finished card that still looks like a collection screen is how somebody
 * walks out without claiming the thing they earned.
 *
 * Monochrome, like every state in this kit: filled for earned, hollow for
 * remaining, the reward space outlined heavier and always labelled in words
 * as well as shape.
 */
export function StampCard({ earned, total, reward, onRedeem, className }: {
  earned: number;
  total: number;
  reward: React.ReactNode;
  onRedeem?: () => void;
  className?: string;
}) {
  const n = Math.max(0, Math.min(earned, total));
  const full = n >= total;
  const left = total - n;

  return (
    <div data-slot="stamp-card" className={cn("inline-flex flex-col gap-2 rounded-xl border border-border bg-card p-3", className)}>
      <p className="text-sm font-medium">{reward}</p>
      <ul className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const got = i < n;
          const isReward = i === total - 1;
          return (
            <li key={i}
              className={cn("flex size-8 items-center justify-center rounded-full border",
                isReward ? "border-2 border-dashed border-foreground" : "border-border",
                got && "border-solid border-foreground bg-foreground text-background")}>
              {got ? <Check className="size-4" aria-hidden />
                   : isReward ? <span className="text-[9px] font-bold leading-none">FREE</span>
                   : <span className="sr-only">not yet</span>}
            </li>
          );
        })}
      </ul>
      {full ? (
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Card full — claim it.</p>
          {onRedeem ? (
            <button type="button" onClick={onRedeem}
              className="cursor-pointer rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
              Redeem
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs tabular-nums text-muted-foreground">
          {n} of {total} · {left} more to go
        </p>
      )}
    </div>
  );
}
