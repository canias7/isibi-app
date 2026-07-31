import * as React from "react";
import { Check, X, Loader, Circle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Passing, failing, running, queued — with the thing that makes it actionable.
 *
 * FAILED SHOWS WHICH STEP. "Build failed" sends somebody to the logs to find
 * out what everyone already knows; "Failed at typecheck" is often the whole
 * answer. This is the same reason `publish-pages.mjs` returns a `stage` rather
 * than only logging it.
 *
 * A distinct GLYPH per state, not five colours: tick, cross, spinner, hollow
 * circle, dash. A CI dashboard is scanned down a column, which is exactly where
 * colour-only status fails for a reader who cannot separate red from green —
 * and this is the classic instance of that mistake.
 *
 * The DURATION is on a finished run and not on a queued one, because a build
 * that took nine minutes and one that took nine seconds are different news, and
 * a stopwatch on something that has not started is noise.
 *
 * "Cancelled" is its own state, never folded into failed. A cancelled build
 * says nothing about the code; counting it as a failure makes a green history
 * look broken.
 */
export function BuildStatus({ status, stage, duration, name, href, className }: {
  status: "passed" | "failed" | "running" | "queued" | "cancelled";
  stage?: React.ReactNode;
  duration?: React.ReactNode;
  name?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const Icon = status === "passed" ? Check
    : status === "failed" ? X
    : status === "running" ? Loader
    : status === "cancelled" ? MinusCircle
    : Circle;
  const word = { passed: "Passed", failed: "Failed", running: "Running", queued: "Queued", cancelled: "Cancelled" }[status];

  const body = (
    <>
      <Icon aria-hidden className={cn("size-4 shrink-0",
        status === "running" && "motion-safe:animate-spin",
        (status === "queued" || status === "cancelled") && "text-muted-foreground")} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">
          {name ? <span className="font-medium">{name} — </span> : null}
          <span className={cn(status === "failed" && "font-medium")}>{word}</span>
          {status === "failed" && stage ? <span> at {stage}</span> : null}
        </span>
      </span>
      {duration && status !== "queued" ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{duration}</span>
      ) : null}
    </>
  );

  const shared = cn("flex items-center gap-2 rounded-md border border-border px-3 py-2", className);
  return href ? (
    <a href={href} className={cn(shared, "hover:bg-muted")}>{body}</a>
  ) : (
    <div className={shared}>{body}</div>
  );
}
