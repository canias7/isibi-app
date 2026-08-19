import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Account standing — strikes against an allowance.
 *
 * STRIKES EXPIRE, AND THE EXPIRY IS SHOWN. A count that only ever goes up is
 * a permanent record wearing a warning's clothes; "your oldest strike
 * expires 12 August" is what makes it a correction instead of a sentence.
 *
 * FILLED AND HOLLOW DOTS, WITH THE WORDS NEXT TO THEM — the monochrome rule.
 * Three red dots is exactly where colour alone fails, and "2 of 3" is the
 * actual information anyway.
 *
 * GOOD STANDING RENDERS, SMALL. On an account page, silence about standing
 * reads as "they are hiding something"; one quiet line answers it. What
 * happens AT the limit is the caller's policy — this component states the
 * count honestly and stops there.
 */
export function StrikeBadge({ strikes = 0, max = 3, oldestExpires, className }: {
  strikes?: number;
  max?: number;
  oldestExpires?: string;
  className?: string;
}) {
  const n = Math.max(0, Math.min(strikes, max));
  return (
    <div className={cn("inline-flex flex-col gap-0.5", className)}>
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1" aria-hidden>
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={cn("size-2 rounded-full border border-foreground",
              i < n ? "bg-foreground" : "bg-transparent")} />
          ))}
        </span>
        <span className="text-sm font-medium">
          {n === 0 ? "In good standing" : n >= max ? `At the limit — ${n} of ${max} strikes` : `${n} of ${max} strikes`}
        </span>
      </span>
      {/* The expiry is what makes a strike a correction rather than a record. */}
      {n > 0 && oldestExpires ? (
        <span className="ps-0.5 text-xs text-muted-foreground">Oldest strike expires {oldestExpires}.</span>
      ) : null}
    </div>
  );
}
