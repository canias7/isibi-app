import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * When somebody last confirmed this is still true.
 *
 * STALE IS A STATE, and it is the one that matters. Opening hours checked three
 * years ago and checked last week look identical in every directory ever built,
 * and the first sends somebody to a closed door.
 *
 * THE THRESHOLD IS THE CALLER'S. A phone number goes stale in years and a price
 * in weeks, so a component that picked would be wrong on most fields it is used
 * for.
 *
 * NEVER VERIFIED IS ITS OWN SENTENCE rather than a blank, since an empty space
 * where a date belongs reads as a loading state.
 */
export function LastVerified({ at, staleAfterDays = 365, onVerify, className }: {
  at?: string | number | Date | null;
  staleAfterDays?: number;
  onVerify?: () => void;
  className?: string;
}) {
  const t = at ? new Date(at).getTime() : null;
  const stale = t !== null && Date.now() - t > staleAfterDays * 86_400_000;
  return (
    <p data-slot="last-verified" className={cn("flex flex-wrap items-baseline gap-x-2 text-xs", className)}>
      <span className={cn(stale || t === null ? "font-medium" : "text-muted-foreground")}>
        {t === null
          ? "Never checked"
          : <>{stale ? "Last checked" : "Checked"} <DateFormat date={t} /></>}
      </span>
      {(stale || t === null) && onVerify && (
        <button type="button" onClick={onVerify} className="cursor-pointer underline underline-offset-2">
          Still right?
        </button>
      )}
    </p>
  );
}
