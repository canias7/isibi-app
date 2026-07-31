import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Several arbitrary dates — not a range, not weekdays.
 *
 * `date-range-picker` IS CONTIGUOUS and `weekday-picker` repeats. The thing
 * neither can say is "these particular days": the three dates a course runs,
 * the four days somebody is away, the two Saturdays a pop-up opens. People
 * currently fake it with a range and a note.
 *
 * PICKED DATES ARE LISTED AS REMOVABLE CHIPS as well as marked in the grid
 * (the filter-bar rule): dates chosen in another month are invisible in this
 * one, and a selection you cannot see is a selection you cannot correct.
 *
 * A MAXIMUM REFUSES AND SAYS SO rather than silently swapping the oldest —
 * "3 of 3 chosen, remove one first" is recoverable; a vanishing date is not.
 *
 * Real buttons in a real month grid, so arrow keys and screen readers work;
 * the accessible name is the full date, because "14" alone means nothing.
 */
export function MultiDatePicker({ value, onChange, max, month, onMonthChange, className }: {
  value: string[];
  onChange: (dates: string[]) => void;
  max?: number;
  /** ISO "YYYY-MM" of the visible month. */
  month: string;
  onMonthChange: (m: string) => void;
  className?: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-start, as elsewhere in the kit
  const picked = new Set(value);
  const full = max != null && value.length >= max;

  const iso = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const shift = (by: number) => {
    const d = new Date(y, m - 1 + by, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className={cn("flex w-64 flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month"
          className="cursor-pointer rounded px-1.5 py-0.5 text-sm hover:bg-muted">‹</button>
        <span className="text-sm font-medium">
          {first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button type="button" onClick={() => shift(1)} aria-label="Next month"
          className="cursor-pointer rounded px-1.5 py-0.5 text-sm hover:bg-muted">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-[10px] text-muted-foreground">{d}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`p${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const key = iso(d);
          const on = picked.has(key);
          return (
            <button key={d} type="button"
              disabled={!on && full}
              aria-pressed={on}
              aria-label={new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              onClick={() => onChange(on ? value.filter((v) => v !== key) : [...value, key].sort())}
              className={cn("h-7 rounded text-xs tabular-nums",
                on ? "cursor-pointer bg-foreground font-medium text-background"
                   : full ? "cursor-not-allowed text-muted-foreground opacity-40"
                          : "cursor-pointer hover:bg-muted")}>
              {d}
            </button>
          );
        })}
      </div>
      {/* Dates in other months are invisible in this grid - the chips are the truth. */}
      {value.length ? (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <button key={v} type="button" onClick={() => onChange(value.filter((x) => x !== v))}
              className="cursor-pointer rounded-full border border-border px-2 py-0.5 text-[11px] tabular-nums hover:bg-muted">
              {v} ×
            </button>
          ))}
        </div>
      ) : null}
      {full ? <p className="text-[11px] font-medium">{value.length} of {max} chosen — remove one first.</p> : null}
    </div>
  );
}
