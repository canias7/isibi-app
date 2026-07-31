import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * One line of a daily or weekly summary email, rendered on screen.
 *
 * IT LEADS WITH THE NUMBER THAT CHANGED, not the label. "4 new bookings" is
 * read; "Bookings: 4" is skimmed past, because the eye goes to the start of the
 * line and a label carries no news.
 *
 * THE COMPARISON IS TO THE SAME PERIOD, and it says so. "+3 on last week" and
 * "+3 on yesterday" mean very different things about a weekly digest, and a
 * bare "+3" is the number people misread most often.
 *
 * NO CHANGE IS STATED, not left blank. An empty delta is ambiguous between
 * "unchanged" and "we could not work it out", and in a digest the second
 * happens often enough to matter.
 *
 * The direction is an arrow AND a word for a screen reader, and whether up is
 * good is the caller's to say — for cancellations it is not. Same rule as
 * `metric-delta`.
 */
export function DigestRow({ count, noun, delta, since, goodWhenUp = true, href, className }: {
  count: number;
  noun: React.ReactNode;
  delta?: number;
  since?: React.ReactNode;
  goodWhenUp?: boolean;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <span className="text-sm">
        <strong className="font-semibold tabular-nums">{count.toLocaleString()}</strong> {noun}
      </span>
      <span className="text-xs text-muted-foreground">
        {delta == null ? "no comparison available"
          : delta === 0 ? <>no change{since ? <> on {since}</> : null}</>
          : (
            <>
              <span aria-hidden>{delta > 0 ? "↑" : "↓"}</span>
              <span className="tabular-nums"> {Math.abs(delta).toLocaleString()}</span>
              {since ? <> on {since}</> : null}
              <span className="sr-only">
                {" "}{delta > 0 ? "up" : "down"} — {(delta > 0) === goodWhenUp ? "better" : "worse"}
              </span>
            </>
          )}
      </span>
    </>
  );
  const shared = cn("flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0", className);
  return href
    ? <a href={href} className={cn(shared, "hover:bg-muted")}>{body}</a>
    : <div className={shared}>{body}</div>;
}
