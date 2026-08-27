import { cn } from "@/lib/utils";
/**
 * Progress toward a goal, as a ring, with the number in the middle.
 *
 * Plain SVG — two circles and a dash offset. Every chart library ships one of
 * these and none of them is worth a runtime dependency for an arc.
 *
 * THE NUMBER IN THE MIDDLE IS THE ACTUAL VALUE, not the percentage. "£8,400" is
 * what somebody is tracking; "70%" makes them multiply to find out what they
 * raised. The percentage goes underneath, OUTSIDE the ring.
 *
 * BOTH OF THOSE ARE SCARS. The value and the percentage used to sit inside the
 * ring as ordinary HTML pulled up over it by a negative margin, so neither was
 * bounded by anything: "62% of £180,000" is wider than a 132px ring and ran
 * straight across the near-black stroke, where its first and last characters
 * became invisible against it. What the reader saw was "2% of £180,00" — not a
 * clipped number anybody would query, but a DIFFERENT AND ENTIRELY PLAUSIBLE
 * one, on a fundraiser, understating the total by a factor of thirty. It
 * compiled, it bundled, and it was found by looking at a render.
 *
 * So the value is an SVG `<text>` sized in viewBox units from its own LENGTH,
 * which makes it scale with the ring at any `size` and makes a seven-figure
 * total physically unable to reach the stroke; and the percentage is a line
 * below the ring, where its width is nobody's problem.
 *
 * PAST 100% THE RING FILLS AND THE TEXT SAYS SO. A ring that wraps a second time
 * is unreadable and one that clamps silently hides the overshoot, which for a
 * fundraiser is the best news of the campaign.
 */
export function GoalGauge({ value, goal, label, unit = "", size = 120, className }: {
  value: number; goal: number; label?: string; unit?: string; size?: number;
  className?: string;
}) {
  if (goal <= 0) return null;
  const pct = (value / goal) * 100;
  const shown = Math.min(pct, 100);
  const r = 44, c = 2 * Math.PI * r;
  const middle = `${unit}${value.toLocaleString()}`;
  // 76 is the budget in viewBox units and 0.70 the advance width of one bold
  // tabular character at font-size 1. BOTH WERE MEASURED, not estimated: a
  // first pass guessed 0.62 and the full inner diameter of 80, and the value
  // came out touching the stroke at both ends in a render. The real advance
  // runs 0.633–0.696 depending on the digits, and the space available is not
  // the diameter but the CHORD at the text's own height — 77.5 units for text
  // 20 tall inside a circle of radius 40, and wider as the text shrinks. So 76
  // is under the tightest case that can occur, with the rest as clearance.
  const fs = Math.min(20, 76 / (0.7 * Math.max(middle.length, 1)));
  return (
    <div data-slot="goal-gauge" className={cn("inline-flex flex-col items-center gap-1", className)}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <g transform="rotate(-90 50 50)">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
            className="stroke-foreground"
            strokeDasharray={c} strokeDashoffset={c - (shown / 100) * c} />
        </g>
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize={fs}
          className="fill-foreground font-semibold [font-variant-numeric:tabular-nums]">
          {middle}
        </text>
      </svg>
      {/* The svg is hidden from the accessibility tree and the value lives
          inside it, so the whole statement is said once, here, in order. */}
      <span className="sr-only">
        {middle} of {unit}{goal.toLocaleString()}, {Math.round(pct)} per cent{label ? `. ${label}` : ""}
      </span>
      {label && <span aria-hidden="true" className="text-sm">{label}</span>}
      <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
        {Math.round(pct)}% of {unit}{goal.toLocaleString()}
      </span>
      {pct > 100 && <span className="text-xs font-medium tabular-nums">{Math.round(pct - 100)}% over goal</span>}
    </div>
  );
}
