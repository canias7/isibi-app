import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "£280 — most are £14–55": an outlier is a QUESTION, not an error.
 *
 * THE COMPARISON IS STATED, because "unusual value" without the usual
 * range is an accusation with no evidence — the reader needs both
 * numbers to judge. And it is a question with a "Looks right" answer:
 * real £280 wedding-party bookings exist, and a flag that cannot be
 * answered teaches people to ignore every flag (the field-warning
 * lesson, for data).
 *
 * DISMISSAL IS REMEMBERED PER VALUE by the caller (`onConfirm`) — asking
 * about the same £280 on every visit is the nag this exists to avoid.
 * The flag never blocks anything; it decorates the value in place.
 */
export function OutlierFlag({ value, usual, confirmed, onConfirm, className }: {
  value: React.ReactNode;
  usual: React.ReactNode;
  confirmed?: boolean;
  onConfirm?: () => void;
  className?: string;
}) {
  if (confirmed) return <span data-slot="outlier-flag" className={cn("tabular-nums", className)}>{value}</span>;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1.5", className)}>
      <span className="border-b-2 border-dotted border-foreground font-medium tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">— most are {usual}.</span>
      {onConfirm ? (
        <button type="button" onClick={onConfirm}
          className="cursor-pointer text-xs underline underline-offset-2">
          Looks right
        </button>
      ) : null}
    </span>
  );
}
