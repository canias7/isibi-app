import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
/**
 * A time of day.
 *
 * A native `<input type="time">`, which is one of the few native pickers
 * genuinely worth using: it follows the visitor's own 12- or 24-hour
 * preference automatically, where any hand-built one picks a convention and
 * is wrong for half of them.
 *
 * The VALUE is always 24-hour `HH:MM` regardless of what is displayed —
 * that is the element's contract, so what comes out of here is comparable
 * and storable without parsing what the user saw.
 */
export function TimeInput({ value, onChange, id, min, max, step = 300, className }: {
  value: string; onChange: (v: string) => void; id?: string;
  min?: string; max?: string; step?: number; className?: string;
}) {
  return (
    <Input id={id} type="time" value={value} min={min} max={max} step={step}
      className={cn("tabular-nums", className)}
      onChange={(e) => onChange(e.target.value)} />
  );
}
