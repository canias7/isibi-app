import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A point on a timeline — a release, a deadline, a payment date.
 *
 * A PAST MILESTONE THAT WAS MISSED LOOKS DIFFERENT from one that was met. Both
 * are in the past and a timeline that renders them identically has lost the
 * only fact anybody wants from it. Met is filled, missed is a hollow ring with
 * a line through it, and both say which in text.
 *
 * THE DATE IS A REAL `<time datetime>` carrying the ISO value, so the exact day
 * is available to a crawler and a screen reader while the reader sees "in 3
 * days". Same rule as `date-format`.
 *
 * "TODAY" IS ITS OWN STATE, because a deadline today is neither upcoming nor
 * past and it is the one that matters most on the day.
 *
 * The dot is `aria-hidden` and the state is in words. A row of circles conveys
 * nothing to a listener.
 */
export function MilestoneDot({ label, at, iso, state = "upcoming", detail, className }: {
  label: React.ReactNode;
  at?: React.ReactNode;
  iso?: string;
  state?: "met" | "missed" | "today" | "upcoming";
  detail?: React.ReactNode;
  className?: string;
}) {
  const word = { met: "met", missed: "missed", today: "due today", upcoming: "upcoming" }[state];
  return (
    <li className={cn("flex items-start gap-3", className)}>
      <span aria-hidden className={cn("mt-1 grid size-3 shrink-0 place-items-center rounded-full",
        state === "met" ? "bg-foreground"
          : state === "today" ? "bg-foreground ring-2 ring-foreground ring-offset-2"
          : state === "missed" ? "border-2 border-foreground"
          : "border border-muted-foreground")}>
        {/* Missed is a hollow ring struck through — past-and-met must not look the same. */}
        {state === "missed" ? <span className="h-px w-full bg-foreground" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", state === "today" && "font-medium")}>
          {label}
          <span className="sr-only"> — {word}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {at ? <time dateTime={iso}>{at}</time> : null}
          {state === "missed" ? <span className="ms-1.5 font-medium text-foreground">missed</span> : null}
          {state === "today" ? <span className="ms-1.5 font-medium text-foreground">today</span> : null}
          {detail ? <span className="ms-1.5">{detail}</span> : null}
        </p>
      </div>
    </li>
  );
}
