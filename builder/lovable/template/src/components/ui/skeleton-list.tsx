import * as React from "react";
import { Shimmer } from "@/components/ui/shimmer";
import { cn } from "@/lib/utils";
/**
 * The placeholder a list shows while its rows load.
 *
 * IT MATCHES THE ROW SHAPE IT STANDS IN FOR — height, avatar, line count —
 * because the entire point of a skeleton is that the real rows replace it
 * without the page jumping. A generic three-bar skeleton under rows of a
 * different height moves everything at the worst moment.
 *
 * ROW WIDTHS VARY ON A FIXED PATTERN, not randomly. Random widths re-roll on
 * every render, so the skeleton flickers as React re-renders while loading —
 * the pattern is indexed, stable, and still reads as text rather than blocks.
 *
 * THE COUNT MATCHES THE EXPECTED PAGE SIZE, capped at what fits. Three
 * placeholder rows for a twenty-row page understate the wait; forty overflow
 * the viewport for no reason.
 *
 * The container carries `aria-busy` and one `sr-only` sentence. The rows are
 * decoration.
 */
const WIDTHS = ["w-3/5", "w-4/5", "w-2/5", "w-3/4", "w-1/2"];

export function SkeletonList({ rows = 6, avatar, lines = 2, delay, className }: {
  rows?: number;
  avatar?: boolean;
  lines?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={className}>
      <p className="sr-only">Loading the list</p>
      <Shimmer delay={delay} className="bg-transparent">
        <ul className="flex flex-col divide-y divide-border">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="flex items-start gap-3 py-3">
              {avatar ? <span className="size-8 shrink-0 rounded-full bg-muted" /> : null}
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                {Array.from({ length: lines }, (_, l) => (
                  <span key={l}
                    className={cn("h-3 rounded bg-muted",
                      // Indexed, not random: random widths re-roll and flicker.
                      l === 0 ? WIDTHS[i % WIDTHS.length] : WIDTHS[(i + l + 2) % WIDTHS.length])} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Shimmer>
    </div>
  );
}
