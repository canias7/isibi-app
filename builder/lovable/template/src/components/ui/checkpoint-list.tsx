import * as React from "react";
import { Check, Circle, X, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The ordered list of things that have to happen, with where it got to.
 *
 * IT STOPS AT THE FAILURE. Everything after a failed checkpoint is "not
 * reached", not "not done" — those are different claims, and marking them as
 * outstanding sends somebody to work on steps that were never attempted.
 *
 * EACH CHECKPOINT CAN CARRY A TIMESTAMP AND A DURATION, because "it got stuck
 * at step 4" and "step 4 took nine minutes" are the two questions asked of any
 * pipeline, and both are free once the times are recorded.
 *
 * A step can be OPTIONAL and skipped without breaking the chain — the same
 * distinction `phase-bar` makes, and for the same reason.
 *
 * States are distinct GLYPHS, and the list is scanned down a column, which is
 * precisely where colour-only status fails.
 */
export type Checkpoint = {
  key: string;
  label: React.ReactNode;
  state: "done" | "running" | "failed" | "todo" | "skipped";
  at?: React.ReactNode;
  took?: React.ReactNode;
  detail?: React.ReactNode;
};

export function CheckpointList({ checkpoints, className }: { checkpoints: Checkpoint[]; className?: string }) {
  const failedAt = checkpoints.findIndex((c) => c.state === "failed");

  return (
    <ol data-slot="checkpoint-list" className={cn("flex flex-col", className)}>
      {checkpoints.map((c, i) => {
        // After a failure, "not reached" — not "not done".
        const unreached = failedAt >= 0 && i > failedAt;
        const Icon = c.state === "done" ? Check
          : c.state === "running" ? Loader
          : c.state === "failed" ? X
          : Circle;
        return (
          <li key={c.key} className="flex items-start gap-2.5 border-b border-border py-2 last:border-0">
            <Icon aria-hidden className={cn("mt-0.5 size-3.5 shrink-0",
              c.state === "running" && "motion-safe:animate-spin",
              (c.state === "todo" || c.state === "skipped" || unreached) && "text-muted-foreground")} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm",
                c.state === "failed" ? "font-medium"
                  : c.state === "skipped" ? "text-muted-foreground line-through"
                  : unreached || c.state === "todo" ? "text-muted-foreground" : "")}>
                {c.label}
                <span className="sr-only">
                  {" — "}
                  {unreached ? "not reached" : c.state === "done" ? "done" : c.state === "running" ? "running"
                    : c.state === "failed" ? "failed" : c.state === "skipped" ? "skipped" : "not started"}
                </span>
              </p>
              {c.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p> : null}
              {unreached ? <p className="mt-0.5 text-xs text-muted-foreground">Not reached</p> : null}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {c.took ?? c.at ?? null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
