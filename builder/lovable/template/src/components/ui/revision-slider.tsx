import * as React from "react";
import { DateFormat } from "@/components/ui/date-format";
import { cn, toDate } from "@/lib/utils";
/**
 * Drag back through the versions of something.
 *
 * A native `<input type="range">`, not a custom track. The browser's one is
 * keyboard-operable, works with a screen reader, honours the OS pointer
 * settings and costs nothing — every hand-rolled slider in this space gets at
 * least one of those wrong.
 *
 * THE INDEX IS NOT THE LABEL. `aria-valuetext` carries the version's date, so a
 * screen reader announces "Tuesday 14:20" rather than "7", which is the number
 * of a thing rather than the thing. It is the single most valuable attribute on
 * this control and the one most often left off.
 *
 * OLDEST ON THE LEFT, newest on the right, because time reads that way and a
 * reversed timeline is a puzzle nobody expected to solve. The caller passes
 * versions newest-first (the order every other component here uses) and the
 * reversal happens inside, so no caller has to hold two orderings in mind.
 */
export function RevisionSlider({ versions, index, onChange, className }: {
  /** Newest first, matching the other history components. */
  versions: { key: string; at: string | number | Date; label?: string }[];
  /** Index into `versions` — 0 is newest. */
  index: number;
  onChange: (index: number) => void;
  className?: string;
}) {
  const id = React.useId();
  if (!versions.length) return null;
  const last = versions.length - 1;
  const current = versions[Math.min(Math.max(index, 0), last)];
  // Oldest sits at the left of the track, so the slider value is the mirror.
  const sliderValue = last - Math.min(Math.max(index, 0), last);
  const text = current.label ?? toDate(current.at).toLocaleString();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">Version</label>
        <span className="text-sm text-muted-foreground">
          <time dateTime={toDate(current.at).toISOString()}><DateFormat date={current.at} withTime /></time>
        </span>
      </div>
      <input
        id={id} type="range" min={0} max={last} step={1} value={sliderValue}
        aria-valuetext={text}
        onChange={(e) => onChange(last - Number(e.target.value))}
        className="w-full cursor-pointer accent-foreground"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Oldest</span>
        <span>Newest</span>
      </div>
    </div>
  );
}
