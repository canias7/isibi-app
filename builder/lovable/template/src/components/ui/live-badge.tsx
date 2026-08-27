import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The LIVE marker.
 *
 * The pulse stops for `prefers-reduced-motion`, and the badge stays perfectly
 * legible without it — the word does all the work and the animation is
 * decoration. A blinking element is a genuine problem for some people, and this
 * one sits on screen for the whole duration of a broadcast.
 *
 * There is a `behind` state, because a live stream that has been paused or
 * scrubbed backwards is no longer live and a badge that still says so is
 * lying about the most time-sensitive thing on the page. It doubles as the
 * control that jumps back to the edge, which is the only thing anybody wants
 * from it in that state.
 *
 * `aria-live` is deliberately NOT used here. The badge sits on screen for
 * hours; announcing it on every re-render is noise, and the transition that
 * matters — falling behind — is a button whose label already says so.
 */
export function LiveBadge({ live = true, behind, onGoLive, label = "Live", className }: {
  live?: boolean;
  behind?: boolean;
  onGoLive?: () => void;
  label?: string;
  className?: string;
}) {
  if (!live) return null;

  if (behind) {
    return (
      <button data-slot="live-badge" type="button" onClick={onGoLive}
        className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground", className)}>
        <span aria-hidden className="size-1.5 rounded-full border border-current" />
        Go live
      </button>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background", className)}>
      <span aria-hidden className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-background opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex size-1.5 rounded-full bg-background" />
      </span>
      {label}
    </span>
  );
}
