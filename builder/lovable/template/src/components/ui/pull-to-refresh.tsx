import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Drag down at the top of a list to reload it.
 *
 * IT ONLY ARMS AT `scrollTop === 0`. Anywhere else the same downward drag is
 * an ordinary scroll, and a version that does not check turns every upward
 * scroll through a long list into a refresh — the failure that makes people
 * hate this pattern.
 *
 * THERE IS ALWAYS A BUTTON TOO. A gesture with no visible equivalent is
 * unavailable on a desktop, to a keyboard, and to anyone who does not know it
 * exists. This one is the same rule as `swipe-actions`.
 *
 * The pull is DAMPED — the indicator moves about half as far as the finger —
 * which is what makes the threshold feel like resistance rather than a cliff,
 * and stops a fast flick triggering a reload that was not meant.
 *
 * It does not fire until RELEASE, past the threshold. Firing on the way past
 * means a scroll that overshoots reloads the list under the reader.
 */
export function PullToRefresh({ onRefresh, refreshing, threshold = 70, children, className }: {
  onRefresh: () => void;
  refreshing?: boolean;
  threshold?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const start = React.useRef<number | null>(null);
  const [pull, setPull] = React.useState(0);
  const armed = pull >= threshold;

  return (
    <div data-slot="pull-to-refresh" className={cn("relative", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span aria-live="polite" className="text-xs text-muted-foreground">
          {refreshing ? "Refreshing…" : armed ? "Release to refresh" : pull > 0 ? "Keep pulling" : null}
        </span>
        <button type="button" onClick={onRefresh} disabled={refreshing}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:pointer-events-none disabled:opacity-60">
          <RefreshCw aria-hidden className={cn("size-3", refreshing && "motion-safe:animate-spin")} />
          Refresh
        </button>
      </div>

      <div
        ref={box}
        onPointerDown={(e) => {
          // Only at the very top; anywhere else this is an ordinary scroll.
          start.current = (box.current?.scrollTop ?? 0) === 0 ? e.clientY : null;
        }}
        onPointerMove={(e) => {
          if (start.current == null) return;
          const dy = e.clientY - start.current;
          // Damped, so the threshold feels like resistance.
          setPull(dy > 0 ? Math.min(threshold * 1.5, dy * 0.5) : 0);
        }}
        onPointerUp={() => {
          if (pull >= threshold && !refreshing) onRefresh();
          start.current = null;
          setPull(0);
        }}
        onPointerCancel={() => { start.current = null; setPull(0); }}
        style={{ touchAction: "pan-y" }}
        className="max-h-72 overflow-y-auto"
      >
        <div style={{ height: pull }} className="flex items-end justify-center overflow-hidden">
          {pull > 8 ? (
            <RefreshCw aria-hidden
              style={{ transform: `rotate(${(pull / threshold) * 180}deg)` }}
              className="mb-1 size-4 text-muted-foreground" />
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
