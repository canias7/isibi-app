import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Within 5 km" — stepped where the useful answers are.
 *
 * THE STEPS ARE A LADDER, NOT A LINE. On a linear 0–50 slider, half the
 * travel is spent between 25 and 50 km — distances nobody searches —
 * while the difference that matters (1 vs 2 km, walk vs drive) is three
 * pixels. The ladder (0.5 · 1 · 2 · 5 · 10 · 25 · 50) gives each useful
 * answer a full stop, which is how people think about distance anyway.
 *
 * THE VALUE IS WORN IN WORDS ("within 5 km"), and the unit is a prop —
 * paired with unit-preference, never guessed from locale (the
 * unit-convert contract: display changes, stored value does not).
 *
 * A real <input type=range> over ladder INDICES, so keyboard arrows
 * step the ladder rung by rung.
 */
export const RADIUS_LADDER = [0.5, 1, 2, 5, 10, 25, 50];

export function RadiusSlider({ value, onChange, ladder = RADIUS_LADDER, unit = "km", className }: {
  value: number;
  onChange: (v: number) => void;
  ladder?: number[];
  unit?: string;
  className?: string;
}) {
  const idx = Math.max(0, ladder.findIndex((v) => v >= value));
  return (
    <label data-slot="radius-slider" className={cn("flex max-w-xs flex-col gap-1", className)}>
      <span className="text-sm">Within <b className="tabular-nums">{ladder[idx]} {unit}</b></span>
      <input
        type="range" min={0} max={ladder.length - 1} step={1} value={idx}
        onChange={(e) => onChange(ladder[Number(e.target.value)])}
        className="cursor-pointer accent-foreground"
        aria-valuetext={`within ${ladder[idx]} ${unit}`}
      />
      <span aria-hidden className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        {ladder.map((l) => <span key={l}>{l}</span>)}
      </span>
    </label>
  );
}
