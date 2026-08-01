import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Put a notification off until later — and say when later is.
 *
 * THE RETURN TIME IS SHOWN AS A REAL TIME, not just "3 hours". "Back at 17:00"
 * is checkable against a calendar; a duration makes the reader do arithmetic
 * they will get wrong, and snoozing something into the middle of a meeting is
 * how people stop using snooze.
 *
 * "TOMORROW MORNING" IS AN OPTION, because it is what most people actually mean
 * and expressing it in hours requires knowing what time it is now. The caller
 * computes the timestamps, since only it knows the reader's working day.
 *
 * A native select, so a phone gets the system picker and the list stays
 * keyboard-navigable without any wiring.
 */
export function SnoozePicker({ options, onSnooze, id, className }: {
  /** Each with the resulting time already worked out. */
  options: { key: string; label: string; until: string }[];
  onSnooze: (key: string) => void;
  id?: string;
  className?: string;
}) {
  if (!options.length) return null;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <label htmlFor={id} className="text-sm text-muted-foreground">Snooze until</label>
      <NativeSelect id={id} value="" className="h-8 w-auto text-sm"
        onChange={(e) => e.target.value && onSnooze(e.target.value)}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label} — back at {o.until}</option>
        ))}
      </NativeSelect>
    </span>
  );
}
