import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Pick from a plan where POSITION carries meaning.
 *
 * EVERY OTHER PICKER IN THIS KIT IS A LIST, and a list cannot answer the
 * question people actually ask — "is that one near the window / by the
 * aisle / next to my friend". Seats, restaurant tables, pitches, desks and
 * lockers are all one shape: items at x/y with a state.
 *
 * TAKEN SEATS STAY VISIBLE AND DISABLED (the availability-grid rule): a plan
 * that hides sold seats makes a half-full room look empty and hides the
 * pattern that tells you where the good ones went.
 *
 * KEYBOARD REACHES EVERY SEAT because they are real buttons in DOM order,
 * with the row and number in the accessible name ("Row C seat 12, taken") —
 * a positioned div grid is unusable without sight, and the position is
 * decoration for that user anyway.
 *
 * The plan is normalised to a 0–100 box so the caller supplies relative
 * coordinates and the component stays responsive without measuring.
 */
export type Seat = { id: string; x: number; y: number; label: string; taken?: boolean; group?: string };

export function SeatMap({ seats, selected, onSelect, legend, className }: {
  seats: Seat[];
  selected?: string[];
  onSelect: (id: string) => void;
  legend?: React.ReactNode;
  className?: string;
}) {
  const chosen = new Set(selected ?? []);
  return (
    <div data-slot="seat-map" className={cn("flex flex-col gap-2", className)}>
      <div className="relative w-full rounded-lg border border-border bg-muted/30" style={{ aspectRatio: "3/2" }}>
        {seats.map((s) => {
          const isChosen = chosen.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              disabled={s.taken}
              onClick={() => onSelect(s.id)}
              aria-pressed={isChosen}
              aria-label={`${s.label}${s.group ? `, ${s.group}` : ""}${s.taken ? ", taken" : ""}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              className={cn(
                "absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border text-[8px] leading-[1.1]",
                s.taken
                  ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through"
                  : isChosen
                    ? "cursor-pointer border-foreground bg-foreground text-background"
                    : "cursor-pointer border-foreground bg-background hover:bg-muted",
              )}
            >
              {s.label.replace(/[^0-9]/g, "").slice(-2)}
            </button>
          );
        })}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-3 rounded-[3px] border border-foreground bg-background" /> free</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-[3px] border border-foreground bg-foreground" /> yours</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-[3px] border border-border bg-muted" /> taken</span>
        {legend}
      </p>
    </div>
  );
}
