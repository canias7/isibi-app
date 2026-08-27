import { cn } from "@/lib/utils";
/**
 * A measurement — with the direction of travel, which a single value hides.
 *
 * THE TREND MATTERS MORE THAN THE VALUE AND IS SHOWN BESIDE IT. A reading inside
 * the normal range that has moved a long way from this person's own usual is
 * frequently the important one, and every single-value display loses that
 * entirely.
 *
 * THE REFERENCE RANGE IS SHOWN WITH THE READING, because a number with no range
 * is uninterpretable to the patient and requires the clinician to remember one.
 * Ranges differ by laboratory, so it comes from the caller.
 *
 * OUT OF RANGE IS MARKED BY WEIGHT AND BY WORDS, never colour alone, and it says
 * high or low rather than just flagging. Which direction is the whole meaning.
 *
 * NO INTERPRETATION. The component reports a number, its range and its movement.
 * What it means about a person is not something a row can say, and a row that
 * tried would be read as though it could.
 */
export function ObservationRow({ what, value, unit, low, high, previousValue, previousOn, takenOn, takenBy, className }: {
  what: string;
  value: number;
  unit?: string;
  /** From the caller — ranges differ by laboratory. */
  low?: number;
  high?: number;
  /** The half a single reading loses. */
  previousValue?: number;
  previousOn?: string;
  takenOn?: string;
  takenBy?: string;
  className?: string;
}) {
  const isLow = low !== undefined && value < low;
  const isHigh = high !== undefined && value > high;
  const out = isLow || isHigh;
  const delta = previousValue !== undefined ? value - previousValue : undefined;
  // Rounded off the raw subtraction: 4.4 − 2.1 is 2.3000000000000003 in binary
  // floating point, and printing that makes the whole row look broken.
  const shownDelta = delta !== undefined ? Math.round(delta * 1000) / 1000 : undefined;
  const movedALot =
    delta !== undefined && previousValue !== undefined && previousValue !== 0
      ? Math.abs(delta / previousValue) >= 0.2
      : false;
  return (
    <li data-slot="observation-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">{what}</span>
        <span className={cn("shrink-0 tabular-nums", out ? "font-medium" : "")}>
          {value}
          {unit ? ` ${unit}` : ""}
          {isLow ? " — low" : isHigh ? " — high" : ""}
        </span>
      </p>
      {(low !== undefined || high !== undefined) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Usual range {low ?? "?"}–{high ?? "?"}
          {unit ? ` ${unit}` : ""}.
        </p>
      )}
      {shownDelta !== undefined && (
        <p className={cn("text-xs tabular-nums", movedALot && !out ? "font-medium" : "text-muted-foreground")}>
          {shownDelta === 0
            ? "Unchanged"
            : `${shownDelta > 0 ? "Up" : "Down"} ${Math.abs(shownDelta)}${unit ? ` ${unit}` : ""} from ${previousValue}`}
          {previousOn ? ` on ${previousOn}` : ""}
          {movedALot && !out ? " — inside the range, but a long way from where it was." : "."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{[takenOn, takenBy].filter(Boolean).join(" · ")}</p>
    </li>
  );
}
