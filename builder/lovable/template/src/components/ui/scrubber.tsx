import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The seek bar, with the two things a bare `<input type="range">` cannot do.
 *
 * BUFFERED ranges are drawn behind the played portion. Without them a stalled
 * video is indistinguishable from a broken one — the bar simply stops — and
 * seeing that the next thirty seconds have arrived is what stops somebody
 * reloading the page.
 *
 * Dragging does NOT seek on every frame. A `pointermove` fires far faster than
 * a video can seek, and sending each one makes the scrub stutter and the
 * network thrash. The position is reported continuously through `onScrub` so
 * the time display follows the finger, and `onSeek` fires once on release.
 *
 * While dragging, the incoming `value` is IGNORED. Otherwise the playhead's own
 * updates fight the finger and the handle springs backwards — the single most
 * common bug in a custom scrubber.
 *
 * A real `role="slider"` with arrow keys, Home and End, and a spoken value in
 * minutes and seconds rather than a raw number of seconds.
 */
export function Scrubber({
  value, duration, buffered = [], onSeek, onScrub, label = "Seek", className,
}: {
  value: number;
  duration: number;
  buffered?: { start: number; end: number }[];
  onSeek: (seconds: number) => void;
  onScrub?: (seconds: number) => void;
  label?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [dragAt, setDragAt] = React.useState<number | null>(null);
  const shown = dragAt ?? value;
  const pct = (s: number) => (duration > 0 ? Math.min(100, Math.max(0, (s / duration) * 100)) : 0);

  const fromClientX = (x: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.min(duration, Math.max(0, ((x - r.left) / r.width) * duration));
  };
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const spoken = (s: number) => {
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return `${m ? `${m} minute${m === 1 ? "" : "s"} ` : ""}${r} second${r === 1 ? "" : "s"}`;
  };
  const nudge = (d: number) => onSeek(Math.min(duration, Math.max(0, value + d)));

  return (
    <div
      ref={ref}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={`${spoken(shown)} of ${spoken(duration)}`}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const t = fromClientX(e.clientX);
        setDragAt(t);
        onScrub?.(t);
      }}
      onPointerMove={(e) => {
        if (dragAt == null) return;
        const t = fromClientX(e.clientX);
        setDragAt(t);
        onScrub?.(t);
      }}
      onPointerUp={(e) => {
        if (dragAt == null) return;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        onSeek(dragAt);
        setDragAt(null);
      }}
      onPointerCancel={() => setDragAt(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); nudge(5); }
        if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-5); }
        if (e.key === "PageUp") { e.preventDefault(); nudge(30); }
        if (e.key === "PageDown") { e.preventDefault(); nudge(-30); }
        if (e.key === "Home") { e.preventDefault(); onSeek(0); }
        if (e.key === "End") { e.preventDefault(); onSeek(duration); }
      }}
      className={cn("group relative h-6 cursor-pointer touch-none select-none py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
    >
      <div className="relative h-1 w-full rounded-full bg-muted">
        {buffered.map((b, i) => (
          <div key={i} aria-hidden className="absolute inset-y-0 rounded-full bg-muted-foreground/40"
            style={{ left: `${pct(b.start)}%`, width: `${Math.max(0, pct(b.end) - pct(b.start))}%` }} />
        ))}
        <div aria-hidden className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${pct(shown)}%` }} />
        <div aria-hidden
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${pct(shown)}%` }} />
      </div>
      <span className="sr-only">{clock(shown)}</span>
    </div>
  );
}
