import { cn } from "@/lib/utils";
/**
 * Whether what is on screen is fresh, and how to make it so.
 *
 * "AS OF" IS THE FIELD PEOPLE ACTUALLY NEED. A cached figure quoted in a
 * meeting as current is the failure this prevents — and a page that shows a
 * six-hour-old number with nothing to say so is indistinguishable from a live
 * one.
 *
 * STALE-WHILE-REVALIDATING IS ITS OWN STATE. What is on screen is old AND fresh
 * data is on the way, which is different from simply old — somebody who knows
 * that waits ten seconds instead of pressing refresh four times.
 *
 * THE REFRESH IS A REAL CONTROL, because the alternative people reach for is a
 * full page reload, which loses their scroll position, their filters and any
 * half-typed form.
 *
 * IT GOES QUIET WHEN THE DATA IS FRESH. A permanent "updated just now" is noise
 * that teaches people to ignore the line on the day it says six hours.
 */
export function CacheStatus({ asOf, staleAfter, state = "fresh", onRefresh, className }: {
  /** Free text — "6 hours ago", "just now". */
  asOf?: string;
  /** How old it is allowed to get — "1 hour". */
  staleAfter?: string;
  state?: "fresh" | "stale" | "revalidating";
  onRefresh?: () => void;
  className?: string;
}) {
  if (state === "fresh" && !onRefresh) return null;
  return (
    <p data-slot="cache-status" className={cn("flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground", className)}>
      {state === "revalidating" ? (
        <span role="status">Showing older figures while newer ones load…</span>
      ) : state === "stale" ? (
        <span>
          <span className="font-medium text-foreground">These figures are out of date</span>
          {asOf && <span> — from {asOf}</span>}
          {staleAfter && <span>, and they are meant to refresh every {staleAfter}</span>}.
        </span>
      ) : (
        asOf && <span>Updated {asOf}</span>
      )}
      {onRefresh && state !== "revalidating" && (
        <button type="button" onClick={onRefresh} className="underline underline-offset-2">
          Get the latest
        </button>
      )}
    </p>
  );
}
