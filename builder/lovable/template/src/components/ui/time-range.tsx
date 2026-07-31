import { TimeInput } from "@/components/ui/time-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * From and to, as times of day.
 *
 * IT ACCEPTS AN END BEFORE THE START and reads it as running past midnight,
 * because 22:00–02:00 is a real shift and a real closing time. Refusing it
 * — the obvious validation — is wrong for every late-opening business, which
 * is the same trap `OpenNow` and `ShiftBadge` handle.
 *
 * The duration is shown, computed the same way, so what has been entered is
 * confirmed in words rather than left to be worked out.
 */
export function TimeRange({ from, to, onFromChange, onToChange, id = "tr", label, className }: {
  from: string; to: string; onFromChange: (v: string) => void; onToChange: (v: string) => void;
  id?: string; label?: string; className?: string;
}) {
  const mins = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const a = mins(from), b = mins(to);
  const overnight = a != null && b != null && b <= a;
  const span = a != null && b != null ? (overnight ? b + 1440 - a : b - a) : null;
  return (
    <div className={cn("space-y-1.5", className)} role="group" aria-label={label}>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">From</Label>
          <TimeInput id={`${id}-from`} value={from} onChange={onFromChange} />
        </div>
        <span className="pb-2 text-sm text-muted-foreground">–</span>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">To</Label>
          <TimeInput id={`${id}-to`} value={to} onChange={onToChange} />
        </div>
      </div>
      {span != null && span > 0 && (
        <p className="text-xs text-muted-foreground">
          {Math.floor(span / 60)}h {span % 60 ? `${span % 60}m` : ""}
          {overnight && " — ends the next day"}
        </p>
      )}
    </div>
  );
}
