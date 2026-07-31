import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "New" — that stops being true on its own.
 *
 * A "NEW" BADGE WITH NO EXPIRY IS ON EVERY PRODUCT WITHIN A YEAR, which is
 * how the word stops meaning anything. This takes the date it ARRIVED and a
 * window, and renders nothing once the window has passed — the shop cannot
 * forget to remove it because it was never a flag to remove.
 *
 * The same shape covers "last chance": pass `until` instead and it counts
 * down to a leaving date rather than up from an arrival.
 */
export function NewInBadge({ arrivedOn, days = 30, className }: {
  arrivedOn: string | number | Date;
  days?: number;
  className?: string;
}) {
  const age = Date.now() - new Date(arrivedOn).getTime();
  if (!(age >= 0) || age > days * 864e5) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full border border-foreground bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background", className)}>
      New in
    </span>
  );
}
