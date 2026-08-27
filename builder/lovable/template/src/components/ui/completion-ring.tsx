import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A ring of several tasks, showing how much of a setup is finished.
 *
 * IT NAMES THE NEXT THING TO DO. A completion ring on its own is a score;
 * the value is entirely in "3 of 5 — next: add your opening hours", which is
 * the line people act on. A percentage with no next step is a nag.
 *
 * IT DISAPPEARS WHEN COMPLETE, after saying so once. A permanent "100%
 * complete" badge is clutter on every future visit, and the reward for
 * finishing should be getting the space back.
 *
 * SEGMENTS, not a continuous arc, because the total is a small countable set.
 * A smooth ring at 60% of five tasks invites the question of what 62% would
 * mean.
 *
 * The gap between segments is drawn with the dash array rather than by
 * rotating separate elements — one circle, no stacking, and it stays correct at
 * any count.
 */
export function CompletionRing({ tasks, size = 64, thickness = 7, nextLabel, onDismiss, className }: {
  tasks: { key: string; label: string; done?: boolean }[];
  size?: number;
  thickness?: number;
  nextLabel?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const done = tasks.filter((t) => t.done).length;
  const next = tasks.find((t) => !t.done);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = tasks.length > 1 ? 4 : 0;
  const seg = circumference / Math.max(1, tasks.length) - gap;

  if (done === tasks.length && tasks.length > 0) {
    return (
      <div data-slot="completion-ring" className={cn("flex items-center gap-2 text-sm", className)}>
        <Check aria-hidden className="size-4" />
        <span>All set up.</span>
        {onDismiss ? (
          <button type="button" onClick={onDismiss}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Hide this
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div role="img" aria-label={`${done} of ${tasks.length} steps done`} style={{ width: size, height: size }} className="relative shrink-0">
        <svg width={size} height={size} aria-hidden className="-rotate-90">
          {tasks.map((t, i) => (
            <circle key={t.key} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness}
              strokeDasharray={`${seg} ${circumference - seg}`}
              strokeDashoffset={-((seg + gap) * i)}
              className={t.done ? "stroke-foreground" : "stroke-muted"} />
          ))}
        </svg>
        <span aria-hidden className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">
          {done}/{tasks.length}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">Finish setting up</p>
        {/* The line people act on. */}
        {next ? <p className="text-xs text-muted-foreground">Next: {nextLabel ?? next.label}</p> : null}
      </div>
    </div>
  );
}
