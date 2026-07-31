import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Two handles on a media timeline — in and out.
 *
 * `scrubber` HAS ONE HANDLE AND SEEKS. Trimming is a different job: two
 * positions that must not cross, a selected span between them, and a
 * duration that is the thing being watched while you drag.
 *
 * HANDLES CANNOT CROSS and the constraint is applied to the VALUE, not by
 * refusing the drag: dragging the in-point past the out-point pushes it
 * along, which is what every editor does, because refusing feels broken.
 *
 * KEYBOARD TRIMS FRAME BY FRAME. Both handles are real sliders with arrow
 * keys and a `step`, because a trim of a tenth of a second is impossible to
 * hit with a pointer and trivial with a key.
 *
 * THE SELECTED DURATION IS PRINTED, always, in seconds — the number people
 * are actually aiming for ("about fifteen seconds for the ad") is never
 * readable off a bar.
 */
export function RangeTrim({ duration, start, end, onChange, step = 0.1, className }: {
  duration: number;
  start: number;
  end: number;
  onChange: (v: { start: number; end: number }) => void;
  step?: number;
  className?: string;
}) {
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative h-10 rounded-md border border-border bg-muted">
        <span aria-hidden className="absolute inset-y-0 bg-foreground/15"
          style={{ left: `${pct(start)}%`, width: `${Math.max(0, pct(end) - pct(start))}%` }} />
        <span aria-hidden className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${pct(start)}%` }} />
        <span aria-hidden className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${pct(end)}%` }} />
      </div>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          In
          <input type="range" min={0} max={duration} step={step} value={start}
            onChange={(e) => {
              const v = Number(e.target.value);
              // Pushing past the other handle moves it, rather than refusing.
              onChange({ start: v, end: Math.max(end, v + step) });
            }}
            className="cursor-pointer accent-foreground" />
        </label>
        <label className="flex flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          Out
          <input type="range" min={0} max={duration} step={step} value={end}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({ end: v, start: Math.min(start, v - step) });
            }}
            className="cursor-pointer accent-foreground" />
        </label>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {fmt(start)} → {fmt(end)} · <b className="text-foreground">{(end - start).toFixed(1)}s selected</b> of {fmt(duration)}
      </p>
    </div>
  );
}
