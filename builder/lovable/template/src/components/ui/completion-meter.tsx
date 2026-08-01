import { cn } from "@/lib/utils";
/**
 * How much of a profile, listing or setup is filled in.
 *
 * THE COUNT LEADS AND THE BAR SUPPORTS IT — "6 of 9 done", not "67%". The
 * fraction tells somebody how much work is left in units they can picture; a
 * percentage makes them estimate.
 *
 * IT NAMES WHAT IS MISSING, capped at a few. A meter that reports a number and
 * nothing else sends the reader hunting through a form for empty fields, which
 * is precisely the work the meter was supposed to save.
 *
 * The bar is aria-hidden with the fraction carrying the value, so a screen
 * reader gets the fact rather than a progressbar reading "67".
 */
export function CompletionMeter({ done, total, missing, label = "Complete", max = 3, className }: {
  done: number; total: number;
  /** Names of what is still empty. */
  missing?: string[];
  label?: string; max?: number;
  className?: string;
}) {
  if (total <= 0) return null;
  const pct = Math.round((done / total) * 100);
  const shown = missing?.slice(0, max) ?? [];
  const rest = (missing?.length ?? 0) - shown.length;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium tabular-nums">{done} of {total}</span>
      </div>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      {shown.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Still to add: {shown.join(", ")}{rest > 0 ? ` and ${rest} more` : ""}
        </p>
      )}
    </div>
  );
}
