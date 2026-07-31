import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The mirror image — leaving soon, with the date it goes.
 *
 * IT NAMES THE DATE rather than shouting "hurry": a deadline a shopper can
 * check is persuasive and survives being wrong; manufactured urgency is the
 * dark pattern this deliberately is not.
 */
export function LastChanceBadge({ until, className }: { until: string | number | Date; className?: string }) {
  const left = new Date(until).getTime() - Date.now();
  if (!(left > 0)) return null;
  const days = Math.ceil(left / 864e5);
  return (
    <span className={cn("inline-flex items-center rounded-full border border-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", className)}>
      Last chance · {days === 1 ? "today" : `${days} days`}
    </span>
  );
}
