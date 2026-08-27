import * as React from "react";
import { cn, scrollBehavior } from "@/lib/utils";
/**
 * One line of a transcript: a timestamp, a speaker, and words you can click to
 * jump to.
 *
 * The timestamp is a `<button>` carrying the SECONDS, so the accessible name
 * reads "Jump to 1 minute 24 seconds" rather than "1:24" — a bare number read
 * out of context tells a listener nothing about what pressing it does.
 *
 * The SPEAKER is only printed when it changes. Repeating "Ada:" on nine
 * consecutive lines is how a transcript becomes unreadable, and the change is
 * the only place the label carries information.
 *
 * The active line is marked by WEIGHT and a rule down the left, not by a
 * background tint alone — a tint at the contrast this kit uses is nearly
 * invisible against alternating rows, and this is the one thing somebody
 * following along needs to find after looking away.
 *
 * `scrollIntoView` is `nearest`, never `center`. Centring fights a person who
 * has scrolled back to read something, yanking the view every few seconds; with
 * `nearest` a line already visible does not move the page at all.
 */
export function TranscriptLine({
  at, speaker, showSpeaker = true, active, onSeek, children, className,
}: {
  at: number;
  speaker?: React.ReactNode;
  showSpeaker?: boolean;
  active?: boolean;
  onSeek?: (seconds: number) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
  }, [active]);

  const m = Math.floor(at / 60), s = Math.floor(at % 60);
  const clock = `${m}:${String(s).padStart(2, "0")}`;
  const spoken = `Jump to ${m ? `${m} minute${m === 1 ? "" : "s"} ` : ""}${s} second${s === 1 ? "" : "s"}`;

  return (
    <div data-slot="transcript-line" ref={ref}
      className={cn("flex gap-3 border-s-2 py-1.5 ps-3",
        active ? "border-foreground" : "border-transparent", className)}>
      <button type="button" onClick={() => onSeek?.(at)} aria-label={spoken}
        className="shrink-0 cursor-pointer text-xs text-muted-foreground tabular-nums hover:text-foreground hover:underline">
        {clock}
      </button>
      <p className={cn("min-w-0 flex-1 text-sm", active && "font-medium")}>
        {speaker && showSpeaker ? (
          <strong className="me-1.5 font-semibold">{speaker}</strong>
        ) : null}
        {children}
      </p>
    </div>
  );
}
