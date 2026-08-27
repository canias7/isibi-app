import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * How long something takes — hours and minutes, as two fields.
 *
 * NOT A MINUTES BOX. "90" is ambiguous to everybody who has ever booked
 * anything (is that an hour and a half or an hour thirty?) and asking for
 * "1h 30m" as free text means parsing every way people write it. Two labelled
 * number fields ask the question exactly once.
 *
 * THE VALUE IS MINUTES, always. Storing hours as a decimal is how 1.5 becomes
 * 1.499999 and a 20-minute slot becomes 0.3333; minutes are an integer and stay
 * one, which is also what every scheduling calculation actually wants.
 *
 * Minutes over 59 ROLL UP rather than being refused — typing 90 into the
 * minutes box is a reasonable thing to do and it becomes 1h 30m, which teaches
 * the format instead of scolding.
 *
 * `inputMode="numeric"` on both, so a phone raises the keypad; and both are
 * `<input type="number">` so the stepper works and the browser validates.
 */
export function DurationInput({ minutes, onChange, maxHours = 99, id, className }: {
  /** Total minutes, or null for empty. */
  minutes: number | null;
  onChange: (minutes: number | null) => void;
  maxHours?: number;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const base = id ?? auto;
  const h = minutes === null ? "" : Math.floor(minutes / 60);
  const m = minutes === null ? "" : minutes % 60;

  const set = (nextH: string, nextM: string) => {
    if (nextH === "" && nextM === "") { onChange(null); return; }
    const hh = Math.max(Number(nextH) || 0, 0);
    const mm = Math.max(Number(nextM) || 0, 0);
    onChange(Math.min(hh * 60 + mm, maxHours * 60 + 59));
  };

  return (
    <span data-slot="duration-input" className={cn("inline-flex items-end gap-2", className)}>
      <span className="flex flex-col gap-1">
        <label htmlFor={`${base}-h`} className="text-xs text-muted-foreground">Hours</label>
        <input id={`${base}-h`} type="number" inputMode="numeric" min={0} max={maxHours}
          value={h} onChange={(e) => set(e.target.value, String(m))}
          className="h-9 w-16 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      </span>
      <span className="flex flex-col gap-1">
        <label htmlFor={`${base}-m`} className="text-xs text-muted-foreground">Minutes</label>
        <input id={`${base}-m`} type="number" inputMode="numeric" min={0}
          value={m} onChange={(e) => set(String(h), e.target.value)}
          className="h-9 w-16 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      </span>
    </span>
  );
}
