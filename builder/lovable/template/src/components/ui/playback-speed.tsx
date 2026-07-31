import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The 1× / 1.5× / 2× control.
 *
 * The current speed is ALWAYS shown, including at 1×. A control that only
 * appears once the speed is unusual leaves somebody wondering why the video
 * sounds odd today with nothing on screen to tell them, and putting it back is
 * a hunt.
 *
 * `preservesPitch` is set explicitly, because the default has changed between
 * browsers and versions — without it, a talk at 1.5× can come out chipmunked,
 * which makes the feature useless for the thing it is for. Written through the
 * three vendor spellings that shipped, since the prefixed ones are what older
 * Safari and Firefox actually read.
 *
 * A closed list of sensible steps rather than a slider: nobody wants 1.37×, and
 * a slider makes returning to exactly 1 a matter of aim.
 */
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

type PitchyMedia = HTMLMediaElement & {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

export function setPlaybackRate(el: HTMLMediaElement | null, rate: number) {
  if (!el) return;
  const m = el as PitchyMedia;
  m.preservesPitch = true;
  m.mozPreservesPitch = true;
  m.webkitPreservesPitch = true;
  el.playbackRate = rate;
}

export function PlaybackSpeed({ value, onChange, rates = RATES, className }: {
  value: number;
  onChange: (rate: number) => void;
  rates?: number[];
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <label htmlFor={id} className="sr-only">Playback speed</label>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-xs tabular-nums outline-none focus-visible:border-ring">
        {rates.map((r) => (
          <option key={r} value={r}>{r === 1 ? "Normal speed" : `${r}×`}</option>
        ))}
      </select>
    </div>
  );
}
