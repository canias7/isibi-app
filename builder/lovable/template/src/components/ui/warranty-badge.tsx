import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "2-year warranty" — and what it actually covers.
 *
 * THE PERIOD ALONE IS MARKETING. Covers-what and starts-when are the terms
 * that decide whether a claim succeeds, so both ride the badge: parts only,
 * from the delivery date, and so on.
 *
 * IT NEVER OVERSTATES BY OMISSION. If the warranty excludes the common case
 * (wear, accidental damage, commercial use), `excludes` prints it in the
 * same breath rather than three clicks away — that is the difference between
 * a badge and a trap.
 */
export function WarrantyBadge({ period, covers, from = "delivery", excludes, className }: {
  period: string;
  covers?: string;
  from?: string;
  excludes?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      <span className="inline-flex w-fit items-center rounded-full border border-foreground px-2 py-0.5 text-[11px] font-medium">
        {period} warranty
      </span>
      <span className="text-[11px] text-muted-foreground">
        {covers ?? "Parts and labour"} · from {from}
        {excludes ? <> · not {excludes}</> : null}
      </span>
    </span>
  );
}
